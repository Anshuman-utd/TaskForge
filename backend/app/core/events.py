import uuid
import logging
from datetime import datetime, UTC
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.core.redis import get_redis_client
from app.models.job import Job

logger = logging.getLogger("app.events")

# Redis Channel Constant
REDIS_EVENTS_CHANNEL = "taskforge:job_events"

# Map database timeline event types to WebSocket real-time event names
EVENT_TYPE_MAPPING = {
    "job_created": "job.created",
    "job_dispatched": "job.dispatched",
    "processing_started": "job.processing",
    "attempt_failed": "job.failed",
    "retry_scheduled": "job.retrying",
    "completed": "job.completed",
    "dead_lettered": "job.dead_lettered",
    "requeued": "job.requeued",
}


class RealtimeEvent(BaseModel):
    event_type: str = Field(..., description="WebSocket event name")
    timestamp: datetime = Field(..., description="UTC timestamp of the event")
    job_id: uuid.UUID = Field(..., description="The job UUID")
    queue_name: str = Field(..., description="The queue name")
    status: str = Field(..., description="Current job status")
    attempt_count: int = Field(..., description="Number of attempts started so far")
    data: Optional[dict[str, Any]] = Field(None, description="Optional event-specific payload")


def publish_job_event(db_job: Job, db_event_type: str, data_payload: Optional[dict[str, Any]] = None):
    """
    Constructs a RealtimeEvent and publishes it to Redis.
    Translates db_event_type to the corresponding WebSocket event type using EVENT_TYPE_MAPPING.
    """
    event_type = EVENT_TYPE_MAPPING.get(db_event_type)
    if not event_type:
        logger.warning(f"No real-time event mapping found for db_event_type: {db_event_type}")
        return

    try:
        event = RealtimeEvent(
            event_type=event_type,
            timestamp=datetime.now(UTC),
            job_id=db_job.id,
            queue_name=db_job.queue_name,
            status=db_job.status,
            attempt_count=db_job.attempt_count,
            data=data_payload
        )
        
        # Serialize the event using model_dump_json()
        serialized_event = event.model_dump_json()
        
        # Publish to Redis
        redis_client = get_redis_client()
        redis_client.publish(REDIS_EVENTS_CHANNEL, serialized_event)
        logger.info(f"Published real-time event {event_type} for job {db_job.id}")
    except Exception as e:
        logger.error(f"Error publishing real-time event {event_type} for job {db_job.id}: {e}", exc_info=True)
