# A. High-Level System Architecture

```md id="s91cgo"
## System Architecture

```mermaid
flowchart LR
    U[Operator / User]
    FE[Next.js Operator Dashboard]
    API[FastAPI API]
    DB[(PostgreSQL)]
    REDIS[(Redis)]
    CELERY[Celery Broker / Queue]
    WORKER[Celery Worker]
    WS[WebSocket Event Stream]

    U --> FE
    FE -->|REST API| API
    FE -->|WebSocket| WS

    API --> DB
    API --> REDIS
    API -->|Dispatch Job| CELERY

    CELERY --> WORKER
    WORKER -->|Update job status / attempts / results| DB
    WORKER -->|Publish realtime job events| REDIS

    REDIS --> WS
    WS --> FE


# B. Job Lifecycle — Success Flow

```md id="94t2vi"
## Job Lifecycle — Success Flow

```mermaid
sequenceDiagram
    participant User as Operator Dashboard
    participant API as FastAPI API
    participant DB as PostgreSQL
    participant Broker as Redis / Celery Queue
    participant Worker as Celery Worker
    participant WS as WebSocket Stream

    User->>API: POST /api/v1/jobs (demo_sleep)
    API->>DB: Create job row (status=queued)
    API->>Broker: Dispatch Celery task
    API-->>User: Job created response

    Worker->>Broker: Pull queued task
    Worker->>DB: Mark job processing + create attempt
    Worker->>WS: Publish job.processing event

    Worker->>Worker: Execute task logic
    Worker->>DB: Mark completed + save result
    Worker->>WS: Publish job.completed event


# C. Job Lifecycle — Failure, Retry, DLQ

```md id="n4akbk"
## Job Lifecycle — Failure, Retry & Dead-Letter Queue

```mermaid
sequenceDiagram
    participant User as Operator Dashboard
    participant API as FastAPI API
    participant DB as PostgreSQL
    participant Broker as Redis / Celery Queue
    participant Worker as Celery Worker
    participant WS as WebSocket Stream

    User->>API: POST /api/v1/jobs (demo_fail)
    API->>DB: Create queued job
    API->>Broker: Dispatch task
    API-->>User: Job created response

    Worker->>Broker: Pull task
    Worker->>DB: Mark processing + create attempt
    Worker->>WS: Publish job.processing

    Worker->>Worker: Execute task
    Worker->>DB: Mark attempt failed
    Worker->>WS: Publish job.failed

    alt retries remain
        Worker->>DB: Set next_retry_at + status=queued
        Worker->>Broker: Re-dispatch with backoff
        Worker->>WS: Publish job.retrying
    else retries exhausted
        Worker->>DB: Mark job dead_lettered
        Worker->>WS: Publish job.dead_lettered
    end


# D. Requeue Flow from Dead Letter Queue

```md id="52zzdy"
## Dead-Letter Requeue Flow

```mermaid
sequenceDiagram
    participant User as Operator Dashboard
    participant API as FastAPI API
    participant DB as PostgreSQL
    participant Broker as Redis / Celery Queue
    participant Worker as Celery Worker
    participant WS as WebSocket Stream

    User->>API: POST /api/v1/jobs/{job_id}/requeue
    API->>DB: Reset retry / DLQ metadata
    API->>Broker: Re-dispatch task
    API->>WS: Publish job.requeued
    API-->>User: Updated queued job

    Worker->>Broker: Pull requeued task
    Worker->>DB: Continue normal processing flow