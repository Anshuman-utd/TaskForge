import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.job_attempt import JobAttempt
    from app.models.job_event import JobEvent

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(50), nullable=False, default="default")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="queued")

    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dead_lettered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    last_error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    attempts: Mapped[list["JobAttempt"]] = relationship(
        "JobAttempt",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    events: Mapped[list["JobEvent"]] = relationship(
        "JobEvent",
        back_populates="job",
        cascade="all, delete-orphan",
    )