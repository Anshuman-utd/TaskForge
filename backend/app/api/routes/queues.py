from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.queue import QueueStatsResponse
from app.services.job_service import JobService

router = APIRouter()


@router.get("/", response_model=QueueStatsResponse)
def get_queue_stats(db: Session = Depends(get_db)):
    """
    Returns counts of jobs by status for each queue.
    """
    return JobService.get_queue_stats(db)
