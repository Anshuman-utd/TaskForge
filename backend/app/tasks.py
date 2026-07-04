import time
import uuid
from celery.utils.log import get_task_logger

from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.job_service import JobService

logger = get_task_logger(__name__)


@celery_app.task(name="app.tasks.demo_sleep", bind=True)
def demo_sleep(self, job_id_str: str, duration: int):
    """
    A demo task that sleeps for a given duration.
    Updates the database job row's status as it runs and completes.
    """
    job_id = uuid.UUID(job_id_str)
    logger.info(f"Starting demo_sleep task for job_id {job_id} with duration {duration}s")

    # Transition to processing
    with SessionLocal() as db:
        JobService.mark_job_processing(db, job_id)

    try:
        time.sleep(duration)
        result = {
            "duration": duration,
            "celery_task_id": self.request.id,
            "message": f"Successfully slept for {duration} seconds.",
        }

        # Transition to completed
        with SessionLocal() as db:
            JobService.mark_job_completed(db, job_id, result)

        logger.info(f"Successfully completed demo_sleep task for job_id {job_id}")

    except Exception as e:
        logger.exception(f"Exception in demo_sleep task for job_id {job_id}")
        # Transition to failed
        with SessionLocal() as db:
            JobService.mark_job_failed(db, job_id, str(e))
        raise e


@celery_app.task(name="app.tasks.demo_fail", bind=True)
def demo_fail(self, job_id_str: str):
    """
    A demo task that intentionally raises an exception to test failure handling.
    Updates the database job row's status as it runs and fails.
    """
    job_id = uuid.UUID(job_id_str)
    logger.info(f"Starting demo_fail task for job_id {job_id}")

    # Transition to processing
    with SessionLocal() as db:
        JobService.mark_job_processing(db, job_id)

    try:
        raise RuntimeError("Simulated job processing failure")

    except Exception as e:
        logger.exception(f"Exception in demo_fail task for job_id {job_id}")
        # Transition to failed
        with SessionLocal() as db:
            JobService.mark_job_failed(db, job_id, str(e))
        raise e
