import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class JobCreate(BaseModel):
    job_type: str = Field(..., description="The type of job to run")
    queue_name: str = Field("default", description="The target queue name")
    payload: dict[str, Any] = Field(default_factory=dict, description="The job payload")
    max_retries: int = Field(3, ge=0, description="Maximum retry attempts")


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_type: str
    queue_name: str
    status: str
    payload: dict[str, Any] = Field(validation_alias="payload_json")
    result: Optional[dict[str, Any]] = Field(default=None, validation_alias="result_json")
    max_retries: int
    attempt_count: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    dead_lettered_at: Optional[datetime] = None
    last_error_message: Optional[str] = None


class JobPageResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    size: int
    pages: int
