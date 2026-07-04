import math
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.job import JobCreate, JobResponse, JobPageResponse
from app.services.job_service import JobService

router = APIRouter()


@router.post("/", response_model=JobResponse, status_code=201)
def create_job(job_in: JobCreate, db: Session = Depends(get_db)):
    """
    Creates a new job.
    """
    db_job = JobService.create_job(
        db,
        job_type=job_in.job_type,
        queue_name=job_in.queue_name,
        payload=job_in.payload,
        max_retries=job_in.max_retries,
    )
    return JobResponse.model_validate(db_job)


@router.get("/", response_model=JobPageResponse)
def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    queue_name: Optional[str] = Query(None, description="Filter by queue name"),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size"),
    db: Session = Depends(get_db),
):
    """
    Lists jobs with pagination and optional filtering.
    """
    items, total = JobService.list_jobs(
        db,
        status=status,
        queue_name=queue_name,
        job_type=job_type,
        page=page,
        size=size,
    )
    pages = math.ceil(total / size) if total > 0 else 0
    serialized_items = [JobResponse.model_validate(item) for item in items]
    return JobPageResponse(
        items=serialized_items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Retrieves a single job by UUID.
    """
    db_job = JobService.get_job_by_id(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(db_job)
