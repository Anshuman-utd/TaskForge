import uuid
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.job import Job

# Explicit mapping from job_type to Celery task names
SUPPORTED_TASKS = {
    "demo_sleep": "app.tasks.demo_sleep",
    "demo_fail": "app.tasks.demo_fail",
}


class JobService:
    @staticmethod
    def create_job(
        db: Session,
        *,
        job_type: str,
        queue_name: str = "default",
        payload: dict = None,
        max_retries: int = 3,
    ) -> Job:
        """
        Creates a new job in the database and dispatches it if supported.
        """
        from datetime import datetime, UTC
        from app.models.job_event import JobEvent

        db_job = Job(
            job_type=job_type,
            queue_name=queue_name,
            payload_json=payload if payload is not None else {},
            max_retries=max_retries,
            status="queued",
        )
        db.add(db_job)
        db.commit()
        db.refresh(db_job)

        now = datetime.now(UTC)

        # Log job_created event
        created_event = JobEvent(
            job_id=db_job.id,
            event_type="job_created",
            timestamp=now,
        )
        db.add(created_event)
        db.commit()

        # Publish event after commit
        from app.core.events import publish_job_event
        publish_job_event(db_job, "job_created")

        # Dispatch if the job type is supported
        celery_task_id = JobService.dispatch_job(db, db_job)
        if celery_task_id:
            db_job.celery_task_id = celery_task_id

            # Log job_dispatched event
            dispatch_event = JobEvent(
                job_id=db_job.id,
                event_type="job_dispatched",
                timestamp=now,
                details={"celery_task_id": celery_task_id},
            )
            db.add(dispatch_event)
            db.commit()
            db.refresh(db_job)

            # Publish event after commit
            publish_job_event(db_job, "job_dispatched", {"celery_task_id": celery_task_id})

        return db_job

    @staticmethod
    def dispatch_job(
        db: Session,
        db_job: Job,
        countdown: Optional[int] = None,
    ) -> Optional[str]:
        """
        Dispatches a job to Celery if supported. Centralizes Celery send_task calls.
        """
        task_name = SUPPORTED_TASKS.get(db_job.job_type)
        if not task_name:
            return None

        # Import celery_app dynamically to prevent circular dependencies
        from app.celery_app import celery_app

        args = [str(db_job.id)]
        if db_job.job_type == "demo_sleep":
            duration = db_job.payload_json.get("duration", 5)
            args.append(duration)

        kwargs = {}
        if countdown is not None:
            kwargs["countdown"] = countdown

        async_result = celery_app.send_task(
            task_name,
            args=args,
            queue=db_job.queue_name,
            **kwargs,
        )
        return async_result.id

    @staticmethod
    def get_job_by_id(db: Session, job_id: uuid.UUID) -> Optional[Job]:
        """
        Fetches a single job by its UUID, eager loading attempts and events.
        """
        from sqlalchemy.orm import selectinload

        query = (
            select(Job)
            .options(
                selectinload(Job.attempts),
                selectinload(Job.events),
            )
            .filter(Job.id == job_id)
        )
        return db.scalar(query)

    @staticmethod
    def list_jobs(
        db: Session,
        *,
        status: Optional[str] = None,
        queue_name: Optional[str] = None,
        job_type: Optional[str] = None,
        page: int = 1,
        size: int = 10,
    ) -> tuple[list[Job], int]:
        """
        Lists jobs with optional filtering and pagination.
        Returns a tuple of (items, total_count).
        """
        query = select(Job)
        count_query = select(func.count()).select_from(Job)

        if status:
            query = query.filter(Job.status == status)
            count_query = count_query.filter(Job.status == status)
        if queue_name:
            query = query.filter(Job.queue_name == queue_name)
            count_query = count_query.filter(Job.queue_name == queue_name)
        if job_type:
            query = query.filter(Job.job_type == job_type)
            count_query = count_query.filter(Job.job_type == job_type)

        total = db.scalar(count_query) or 0

        # Apply pagination and sorting (newest first)
        offset = (page - 1) * size
        query = query.order_by(Job.created_at.desc()).offset(offset).limit(size)
        items = db.scalars(query).all()

        return list(items), total

    @staticmethod
    def mark_job_processing(
        db: Session,
        job_id: uuid.UUID,
        worker_name: Optional[str] = None,
    ) -> Job:
        """
        Transitions job status to 'processing' and sets started_at timestamp.
        Increments attempt_count and creates a JobAttempt record.
        """
        from datetime import datetime, UTC
        from app.models.job_attempt import JobAttempt
        from app.models.job_event import JobEvent

        db_job = db.get(Job, job_id)
        if db_job:
            now = datetime.now(UTC)
            db_job.status = "processing"
            db_job.started_at = now
            db_job.attempt_count += 1

            # Track attempt
            attempt = JobAttempt(
                job_id=db_job.id,
                attempt_number=db_job.attempt_count,
                worker_name=worker_name,
                status="processing",
                celery_task_id=db_job.celery_task_id,
                started_at=now,
            )
            db.add(attempt)

            # Log event
            event = JobEvent(
                job_id=db_job.id,
                event_type="processing_started",
                timestamp=now,
                details={
                    "attempt_number": db_job.attempt_count,
                    "celery_task_id": db_job.celery_task_id,
                },
            )
            db.add(event)
            db.commit()
            db.refresh(db_job)

            # Publish event after commit
            from app.core.events import publish_job_event
            publish_job_event(
                db_job,
                "processing_started",
                {
                    "attempt_number": db_job.attempt_count,
                    "celery_task_id": db_job.celery_task_id,
                }
            )
        return db_job

    @staticmethod
    def mark_job_completed(db: Session, job_id: uuid.UUID, result: dict) -> Job:
        """
        Transitions job status to 'completed', sets completed_at timestamp, and saves result JSON.
        Updates the active JobAttempt to completed and logs a completed event.
        """
        from datetime import datetime, UTC
        from app.models.job_event import JobEvent

        db_job = db.get(Job, job_id)
        if db_job:
            now = datetime.now(UTC)
            db_job.status = "completed"
            db_job.completed_at = now
            db_job.result_json = result

            # Update latest attempt
            active_attempt = None
            if db_job.attempts:
                active_attempt = sorted(
                    db_job.attempts, key=lambda x: x.attempt_number
                )[-1]
            if active_attempt and active_attempt.status == "processing":
                active_attempt.status = "completed"
                active_attempt.finished_at = now
                duration = now - active_attempt.started_at
                active_attempt.duration_ms = int(
                    duration.total_seconds() * 1000
                )

            # Log event
            event = JobEvent(
                job_id=db_job.id,
                event_type="completed",
                timestamp=now,
                details={"result": result},
            )
            db.add(event)
            db.commit()
            db.refresh(db_job)

            # Publish event after commit
            from app.core.events import publish_job_event
            publish_job_event(db_job, "completed", {"result": result})
        return db_job

    @staticmethod
    def mark_job_failed(db: Session, job_id: uuid.UUID, error_message: str) -> Job:
        """
        Transitions job status. If attempts remain, schedules a retry with progressive backoff.
        If attempts are exhausted, marks the job as dead_lettered.
        """
        from datetime import datetime, UTC, timedelta
        from app.models.job_event import JobEvent

        db_job = db.get(Job, job_id)
        if not db_job:
            return None

        now = datetime.now(UTC)

        # Update latest attempt
        active_attempt = None
        if db_job.attempts:
            active_attempt = sorted(
                db_job.attempts, key=lambda x: x.attempt_number
            )[-1]
        if active_attempt and active_attempt.status == "processing":
            active_attempt.status = "failed"
            active_attempt.finished_at = now
            duration = now - active_attempt.started_at
            active_attempt.duration_ms = int(duration.total_seconds() * 1000)
            active_attempt.error_message = error_message

        # Log attempt_failed event
        failed_event = JobEvent(
            job_id=db_job.id,
            event_type="attempt_failed",
            timestamp=now,
            details={
                "attempt_number": db_job.attempt_count,
                "error": error_message,
                "celery_task_id": db_job.celery_task_id,
            },
        )
        db.add(failed_event)
        db.commit()

        # Publish failed event after commit
        from app.core.events import publish_job_event
        publish_job_event(
            db_job,
            "attempt_failed",
            {
                "attempt_number": db_job.attempt_count,
                "error": error_message,
                "celery_task_id": db_job.celery_task_id,
            }
        )

        # Retry Eligibility Logic
        # - attempt_count: number of attempts already started
        # - max_retries: number of retries allowed after the first attempt
        # - total possible executions: 1 + max_retries
        total_possible_executions = 1 + db_job.max_retries

        if db_job.attempt_count < total_possible_executions:
            # Progressive backoff: 2 ** attempt_count seconds
            delay = 2**db_job.attempt_count
            next_retry = now + timedelta(seconds=delay)

            db_job.status = "queued"
            db_job.next_retry_at = next_retry
            db_job.last_error_message = error_message

            # Log retry_scheduled event
            retry_event = JobEvent(
                job_id=db_job.id,
                event_type="retry_scheduled",
                timestamp=now,
                details={
                    "attempt_number": db_job.attempt_count,
                    "countdown_seconds": delay,
                    "next_retry_at": next_retry.isoformat(),
                    "error": error_message,
                },
            )
            db.add(retry_event)
            db.commit()
            db.refresh(db_job)

            # Publish retry scheduled event after commit
            publish_job_event(
                db_job,
                "retry_scheduled",
                {
                    "attempt_number": db_job.attempt_count,
                    "countdown_seconds": delay,
                    "next_retry_at": next_retry.isoformat(),
                    "error": error_message,
                }
            )

            # Centralized dispatch reuse
            new_task_id = JobService.dispatch_job(db, db_job, countdown=delay)
            if new_task_id:
                db_job.celery_task_id = new_task_id

                # Log job_dispatched event for the retry
                dispatch_event = JobEvent(
                    job_id=db_job.id,
                    event_type="job_dispatched",
                    timestamp=now,
                    details={
                        "attempt_number": db_job.attempt_count + 1,
                        "countdown_seconds": delay,
                        "celery_task_id": new_task_id,
                    },
                )
                db.add(dispatch_event)
                db.commit()
                db.refresh(db_job)

                # Publish job dispatched event after commit
                publish_job_event(
                    db_job,
                    "job_dispatched",
                    {
                        "attempt_number": db_job.attempt_count + 1,
                        "countdown_seconds": delay,
                        "celery_task_id": new_task_id,
                    }
                )
        else:
            # Exhausted retries -> Dead letter
            db_job.status = "dead_lettered"
            db_job.dead_lettered_at = now
            db_job.last_error_message = error_message

            dlq_event = JobEvent(
                job_id=db_job.id,
                event_type="dead_lettered",
                timestamp=now,
                details={
                    "total_attempts": db_job.attempt_count,
                    "error": error_message,
                },
            )
            db.add(dlq_event)
            db.commit()
            db.refresh(db_job)

            # Publish dead letter event after commit
            publish_job_event(
                db_job,
                "dead_lettered",
                {
                    "total_attempts": db_job.attempt_count,
                    "error": error_message,
                }
            )

        return db_job

    @staticmethod
    def requeue_job(db: Session, job_id: uuid.UUID) -> Optional[Job]:
        """
        Requeues a dead-lettered job, resetting attempt count and dispatching to Celery.
        Restricted to dead_lettered jobs.
        """
        from datetime import datetime, UTC
        from app.models.job_event import JobEvent

        db_job = db.get(Job, job_id)
        if not db_job:
            return None

        if db_job.status != "dead_lettered":
            raise ValueError("Only dead_lettered jobs can be requeued")

        now = datetime.now(UTC)
        db_job.status = "queued"
        db_job.attempt_count = 0
        db_job.dead_lettered_at = None
        db_job.last_error_message = None
        db_job.next_retry_at = None
        db_job.result_json = None

        # Log requeued event
        requeue_event = JobEvent(
            job_id=db_job.id,
            event_type="requeued",
            timestamp=now,
        )
        db.add(requeue_event)
        db.commit()

        # Publish event after commit
        from app.core.events import publish_job_event
        publish_job_event(db_job, "requeued")

        # Centralized dispatch reuse
        new_task_id = JobService.dispatch_job(db, db_job)
        if new_task_id:
            db_job.celery_task_id = new_task_id

            # Log job_dispatched event
            dispatch_event = JobEvent(
                job_id=db_job.id,
                event_type="job_dispatched",
                timestamp=now,
                details={"celery_task_id": new_task_id},
            )
            db.add(dispatch_event)
            db.commit()
            db.refresh(db_job)

            # Publish event after commit
            publish_job_event(db_job, "job_dispatched", {"celery_task_id": new_task_id})

        return db_job

    @staticmethod
    def get_queue_stats(db: Session) -> dict:
        """
        Retrieves stats (counts of jobs per status) grouped by queue_name.
        Returns a dictionary shaped to match QueueStatsResponse:
        {"items": [QueueStatsItem, ...]}
        """
        # Query counts grouped by queue_name and status
        query = select(Job.queue_name, Job.status, func.count(Job.id)).group_by(Job.queue_name, Job.status)
        rows = db.execute(query).all()

        # Temporary dictionary mapping queue_name to stats
        queue_map = {}
        for queue_name, status, count in rows:
            if queue_name not in queue_map:
                queue_map[queue_name] = {
                    "queue_name": queue_name,
                    "queued": 0,
                    "processing": 0,
                    "completed": 0,
                    "failed": 0,
                    "dead_lettered": 0,
                }
            if status in queue_map[queue_name]:
                queue_map[queue_name][status] = count

        return {"items": list(queue_map.values())}
