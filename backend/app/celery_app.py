from celery import Celery
from app.core.config import settings

# Initialize Celery with Redis broker.
# No result backend is configured, as PostgreSQL is the persistent source of truth.
celery_app = Celery(
    "taskforge",
    broker=settings.REDIS_URL,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_default_queue="default",
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
