
And here’s the **single big architecture diagram** for `docs/architecture.md`:

```md
# TaskForge Architecture

```mermaid
flowchart TB
    %% =========================
    %% CLIENT / CONTROL PLANE
    %% =========================
    subgraph CLIENT["Operator Control Plane"]
        USER[Operator / User]
        FE[Next.js Dashboard]
        PAGES[Dashboard / Jobs / Job Detail / Dead Letter / Queues]
        MODAL[Dispatch Job Modal]
        LIVE[Live Events Feed]
    end

    %% =========================
    %% API LAYER
    %% =========================
    subgraph API_LAYER["FastAPI Backend"]
        API[FastAPI App]
        JOB_ROUTES[Jobs API\nPOST /jobs\nGET /jobs\nGET /jobs/:id\nPOST /jobs/:id/requeue]
        QUEUE_ROUTES[Queue Stats API\nGET /queues]
        WS_ENDPOINT[WebSocket Endpoint\n/ws/dashboard]
        JOB_SERVICE[Job Service Layer]
        EVENTS[Realtime Event Publisher]
        LISTENER[Redis Event Listener]
    end

    %% =========================
    %% PERSISTENCE LAYER
    %% =========================
    subgraph DATA_LAYER["Persistence Layer"]
        DB[(PostgreSQL)]
        JOBS_TABLE[(jobs)]
        ATTEMPTS_TABLE[(job_attempts)]
        EVENTS_TABLE[(job_events)]
    end

    %% =========================
    %% QUEUE / WORKER LAYER
    %% =========================
    subgraph WORKER_LAYER["Queue + Worker Layer"]
        REDIS[(Redis)]
        CELERY_QUEUE[Celery Queue / Broker]
        WORKER[Celery Worker]
        TASK_SLEEP[demo_sleep task]
        TASK_FAIL[demo_fail task]
    end

    %% =========================
    %% DASHBOARD FLOW
    %% =========================
    USER --> FE
    FE --> PAGES
    FE --> MODAL
    FE --> LIVE

    %% =========================
    %% FRONTEND -> BACKEND
    %% =========================
    FE -->|REST API requests| API
    FE -->|WebSocket connection| WS_ENDPOINT

    %% =========================
    %% API INTERNAL FLOW
    %% =========================
    API --> JOB_ROUTES
    API --> QUEUE_ROUTES
    API --> WS_ENDPOINT

    JOB_ROUTES --> JOB_SERVICE
    QUEUE_ROUTES --> JOB_SERVICE

    %% =========================
    %% SERVICE -> DATABASE
    %% =========================
    JOB_SERVICE -->|create / update / query jobs| DB
    DB --> JOBS_TABLE
    DB --> ATTEMPTS_TABLE
    DB --> EVENTS_TABLE

    %% =========================
    %% JOB DISPATCH FLOW
    %% =========================
    JOB_SERVICE -->|dispatch supported jobs| CELERY_QUEUE
    CELERY_QUEUE --> WORKER
    REDIS --> CELERY_QUEUE

    %% =========================
    %% WORKER EXECUTION FLOW
    %% =========================
    WORKER --> TASK_SLEEP
    WORKER --> TASK_FAIL

    TASK_SLEEP -->|mark processing / completed| JOB_SERVICE
    TASK_FAIL -->|mark processing / failed / retry / DLQ| JOB_SERVICE

    %% =========================
    %% RELIABILITY / RETRY FLOW
    %% =========================
    JOB_SERVICE -->|create attempt row| ATTEMPTS_TABLE
    JOB_SERVICE -->|append timeline event| EVENTS_TABLE
    JOB_SERVICE -->|update status / result / error / retry metadata| JOBS_TABLE

    %% =========================
    %% RETRY / DLQ LOGIC
    %% =========================
    JOB_SERVICE -->|if failure and retries remain -> schedule retry| CELERY_QUEUE
    JOB_SERVICE -->|if retries exhausted -> mark dead_lettered| JOBS_TABLE

    %% =========================
    %% REALTIME EVENT FLOW
    %% =========================
    JOB_SERVICE --> EVENTS
    EVENTS -->|publish lifecycle event| REDIS
    REDIS --> LISTENER
    LISTENER --> WS_ENDPOINT
    WS_ENDPOINT -->|broadcast live updates| FE

    %% =========================
    %% REQUEUE FLOW
    %% =========================
    FE -->|POST /jobs/:id/requeue| JOB_ROUTES
    JOB_ROUTES --> JOB_SERVICE
    JOB_SERVICE -->|reset DLQ metadata + redispatch| CELERY_QUEUE