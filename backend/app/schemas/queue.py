from pydantic import BaseModel, Field


class QueueStatsItem(BaseModel):
    queue_name: str = Field(..., description="The name of the queue")
    queued: int = Field(0, ge=0, description="Count of queued jobs")
    processing: int = Field(0, ge=0, description="Count of processing jobs")
    completed: int = Field(0, ge=0, description="Count of completed jobs")
    failed: int = Field(0, ge=0, description="Count of failed jobs (legacy/transient)")
    dead_lettered: int = Field(0, ge=0, description="Count of dead lettered jobs")


class QueueStatsResponse(BaseModel):
    items: list[QueueStatsItem] = Field(default_factory=list, description="List of stats per queue")
