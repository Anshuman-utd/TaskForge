import uuid
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.job import Job


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
        Creates a new job in the database.
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
        # Base query for filtering
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

        # Get total count
        total = db.scalar(count_query) or 0

        # Apply pagination and sorting (newest first)
        offset = (page - 1) * size
        query = query.order_by(Job.created_at.desc()).offset(offset).limit(size)
        items = db.scalars(query).all()

        return list(items), total
