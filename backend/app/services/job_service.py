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

        # Dispatch if the job type is supported
        task_name = SUPPORTED_TASKS.get(job_type)
        if task_name:
            # Import celery_app dynamically to prevent circular dependencies
            from app.celery_app import celery_app

            args = [str(db_job.id)]
            if job_type == "demo_sleep":
                duration = db_job.payload_json.get("duration", 5)
                args.append(duration)

            async_result = celery_app.send_task(
                task_name,
                args=args,
                queue=queue_name,
            )
            # Store the Celery task ID
            db_job.celery_task_id = async_result.id
            db.commit()
            db.refresh(db_job)

        return db_job

    @staticmethod
    def get_job_by_id(db: Session, job_id: uuid.UUID) -> Optional[Job]:
        """
        Fetches a single job by its UUID.
        """
        return db.get(Job, job_id)

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
    def mark_job_processing(db: Session, job_id: uuid.UUID) -> Job:
        """
        Transitions job status to 'processing' and sets started_at timestamp.
        """
        from datetime import datetime, UTC

        db_job = db.get(Job, job_id)
        if db_job:
            db_job.status = "processing"
            db_job.started_at = datetime.now(UTC)
            db.commit()
            db.refresh(db_job)
        return db_job

    @staticmethod
    def mark_job_completed(db: Session, job_id: uuid.UUID, result: dict) -> Job:
        """
        Transitions job status to 'completed', sets completed_at timestamp, and saves result JSON.
        """
        from datetime import datetime, UTC

        db_job = db.get(Job, job_id)
        if db_job:
            db_job.status = "completed"
            db_job.completed_at = datetime.now(UTC)
            db_job.result_json = result
            db.commit()
            db.refresh(db_job)
        return db_job

    @staticmethod
    def mark_job_failed(db: Session, job_id: uuid.UUID, error_message: str) -> Job:
        """
        Transitions job status to 'failed' and saves the error message.
        """
        from datetime import datetime, UTC

        db_job = db.get(Job, job_id)
        if db_job:
            db_job.status = "failed"
            db_job.completed_at = datetime.now(UTC)
            db_job.last_error_message = error_message
            db.commit()
            db.refresh(db_job)
        return db_job
