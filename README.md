# TaskForge 

### TaskForge is a distributed job processing platform and operator control plane built to demonstrate backend system design, database-backed reliability patterns, and real-time observability.

<p align="left">
  <img src="https://img.shields.io/badge/FastAPI-0d1117?style=for-the-badge&logo=fastapi&logoColor=009688" />
  <img src="https://img.shields.io/badge/Python-0d1117?style=for-the-badge&logo=python&logoColor=3776AB" />
  <img src="https://img.shields.io/badge/Celery-0d1117?style=for-the-badge&logo=celery&logoColor=37814A" />
  <img src="https://img.shields.io/badge/Redis-0d1117?style=for-the-badge&logo=redis&logoColor=DC382D" />
  <img src="https://img.shields.io/badge/PostgreSQL-0d1117?style=for-the-badge&logo=postgresql&logoColor=4169E1" />
  <img src="https://img.shields.io/badge/SQLAlchemy-0d1117?style=for-the-badge&logo=sqlalchemy&logoColor=D71F00" />
  <img src="https://img.shields.io/badge/Alembic-0d1117?style=for-the-badge&logo=alembic&logoColor=ffffff" />
  <img src="https://img.shields.io/badge/Next.js-0d1117?style=for-the-badge&logo=nextdotjs&logoColor=ffffff" />
  <img src="https://img.shields.io/badge/TypeScript-0d1117?style=for-the-badge&logo=typescript&logoColor=3178C6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-0d1117?style=for-the-badge&logo=tailwindcss&logoColor=06B6D4" />
  <img src="https://img.shields.io/badge/Docker-0d1117?style=for-the-badge&logo=docker&logoColor=2496ED" />
  <img src="https://img.shields.io/badge/WebSockets-0d1117?style=for-the-badge&logo=socketdotio&logoColor=ffffff" />
</p>

The system integrates a FastAPI application, PostgreSQL database, Redis broker, and Celery background workers alongside a Next.js App Router operator control panel. TaskForge provides durability guarantees for job states, handles execution failures using automated retries with progressive exponential backoffs, transitions stalled jobs into a Dead-Letter Queue (DLQ), and streams live lifecycle updates to dashboard clients over WebSockets.

---

## 1. Project Motivation

Distributed job processing systems often suffer from observability gaps when relying solely on transient broker memory. TaskForge was built to showcase the implementation of infrastructure-level reliability patterns:

* **State Durability**: Job states are modeled in a relational database as the single source of truth, rather than relying solely on broker memory.
* **Granular Traceability**: Every execution attempt and state transition is captured in persistent tables, providing a historic audit trail for debugging.
* **Failure Resiliency**: Instead of simple execution failure, TaskForge implements progressive exponential backoffs, moving repeatedly failing tasks into a managed Dead-Letter Queue (DLQ) for operator recovery.
* **Real-time Observability**: Combining Redis Pub/Sub with WebSocket multiplexing allows operators to monitor task execution live without polling.

---

## 2. Core Features

### Asynchronous Job Execution
Long-running operations are offloaded from the FastAPI HTTP thread pool to Celery background task processes using Redis as the message broker.

### State-Backed Retries and DLQ
Jobs that encounter runtime exceptions are retried automatically. Each retry uses a progressive backoff delay. If a job exhausts its retry limit, it transitions to a `dead_lettered` state.

### Audit Timeline and Attempts History
Each execution attempt is logged as an independent record in the database tracking start times, completion times, and traceback exceptions. Job status changes trigger timeline audit logs, building a visual execution trace.

### Operator Control Panel
A unified developer interface built with Next.js provides summary aggregates, active queue backlogs, recent activity, and an interactive job dispatch panel.

### Requeue and Recovery Workflows
Operators can requeue dead-lettered jobs directly from the dashboard, resetting execution attempts and re-triggering Celery execution runs.

### WebSocket Broadcasting
Backend state transitions publish structured payloads to a Redis Pub/Sub channel. A FastAPI background task listens to this stream and broadcasts events to connected dashboard clients.

---



## 3. Tech Stack

### Backend
* **FastAPI**: Core REST API framework and WebSocket server.
* **Celery**: Asynchronous worker execution.
* **SQLAlchemy + Alembic**: Database mapping and schema migrations.
* **Pydantic**: Input validation and schema serialization.

### Frontend
* **Next.js (App Router)**: Client interface built with TypeScript.
* **Tailwind CSS**: Visual layout styling.

### Infrastructure
* **PostgreSQL**: Persistent relational storage.
* **Redis**: Celery broker and Pub/Sub channel manager.
* **Docker Compose**: Containerized environment orchestration.

---

## 4. System Design Highlights

TaskForge is designed to showcase backend and distributed-systems concepts that are usually hidden behind internal tooling:

- **Durable job state modeling** in PostgreSQL instead of treating the message broker as the source of truth
- **Asynchronous worker execution** using Celery + Redis with queue-based dispatch
- **Retry orchestration with progressive backoff** and explicit dead-letter transitions
- **Persistent execution observability** through separate `jobs`, `job_attempts`, and `job_events` tables
- **Realtime monitoring pipeline** using Redis Pub/Sub and FastAPI WebSocket broadcasting
- **Operator recovery workflows** through dashboard-based dead-letter inspection and requeueing

## 5. Architecture Overview

TaskForge separates job processing from state tracking. The API handles client actions and queries, Celery handles job execution, and PostgreSQL maintains the system state.

```
+--------------------------------------------------------------------------------------------------+
|                                           TASKFORGE                                              |
+--------------------------------------------------------------------------------------------------+

   Operator / Browser
          |
          |  REST + WebSocket
          v
+---------------------------+                 +----------------------------------+
|   Next.js Dashboard       |                 |         FastAPI Backend          |
|---------------------------|                 |----------------------------------|
| /dashboard                |<--------------->| Jobs API / Queues API / WS API   |
| /jobs                     |                 | Job dispatch + query endpoints    |
| /jobs/[id]                |                 +------------------+---------------+
| /dead-letter              |                                    |
| /queues                   |                                    |
+---------------------------+                                    v
                                                   +-----------------------------+
                                                   |      Job Service Layer       |
                                                   |-----------------------------|
                                                   | create / dispatch jobs       |
                                                   | mark processing/completed    |
                                                   | mark failed / retry / DLQ    |
                                                   | requeue dead-lettered jobs   |
                                                   | publish realtime events      |
                                                   +--------+-----------+---------+
                                                            |           |
                                         persistent state   |           | async dispatch / events
                                                            |           |
                                                            v           v
                                           +--------------------+   +--------------------+
                                           |    PostgreSQL      |   |       Redis        |
                                           |--------------------|   |--------------------|
                                           | jobs               |   | Celery broker      |
                                           | job_attempts       |   | Pub/Sub channel    |
                                           | job_events         |   +---------+----------+
                                           +--------------------+             |
                                                                              |
                                                                              v
                                                                  +----------------------+
                                                                  |    Celery Worker     |
                                                                  |----------------------|
                                                                  | demo_sleep           |
                                                                  | demo_fail            |
                                                                  | task execution       |
                                                                  +----------+-----------+
                                                                             |
                                                                             | updates job state through service layer
                                                                             v
                                                                   +----------------------+
                                                                   |  PostgreSQL + Redis  |
                                                                   | state updates + RT   |
                                                                   +----------------------+
```

---

## 6. System Components

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Control Dashboard** | Next.js | Provides operator UI, dispatch modal, and live log stream. |
| **API Server** | FastAPI | Exposes jobs, queues, requeue, and WebSocket endpoints. |
| **Relational Database** | PostgreSQL | Persistent source of truth for jobs, attempts, and audit events. |
| **Message Broker** | Redis | Facilitates Celery message queueing and Pub/Sub broadcasting. |
| **Execution Pool** | Celery Worker | Asynchronously processes tasks (`demo_sleep` / `demo_fail`). |
| **Pub/Sub Listener** | FastAPI Task | Runs as a background task, routing Redis events to client WebSockets. |

---

## 7. Data Model

The database schema, implemented in `backend/app/models/`, consists of three core tables:

### 1. `jobs`
Maintains the status and parameters of execution blocks.
* `id` (`UUID`, Primary Key): Unique job identifier.
* `job_type` (`String`): Registered celery task handler (e.g. `demo_sleep`, `demo_fail`).
* `queue_name` (`String`): Broker target queue routing queue (default: `default`).
* `status` (`String`): Current job state (`queued`, `processing`, `completed`, `dead_lettered`).
* `payload_json` (`JSONB`): Input arguments passed to the worker task.
* `result_json` (`JSONB`, Nullable): Output dictionary returned by successful execution.
* `max_retries` (`Integer`): Maximum number of retry attempts.
* `attempt_count` (`Integer`): Current execution attempts started.
* `created_at` / `started_at` / `completed_at` (`DateTime`): Process timestamps.
* `next_retry_at` / `dead_lettered_at` (`DateTime`): Lifecycle dates.
* `last_error_message` (`Text`): Traceback exception summary of the latest failure.
* `celery_task_id` (`String`): Underlying broker task identifier.

### 2. `job_attempts`
Logs details of individual execution attempts for audit purposes.
* `id` (`UUID`, Primary Key): Attempt record identifier.
* `job_id` (`UUID`, Foreign Key): Associated job record.
* `attempt_number` (`Integer`): The iteration index of this attempt.
* `worker_name` (`String`): Process hostname of the executing worker.
* `status` (`String`): Success or failure state of the attempt.
* `started_at` / `finished_at` (`DateTime`): Run duration timestamps.
* `duration_ms` (`Integer`): Duration in milliseconds.
* `error_message` (`Text`): Specific error traceback returned during this attempt.

### 3. `job_events`
Chronological database of lifecycle events for auditing and trace generation.
* `id` (`UUID`, Primary Key): Event identifier.
* `job_id` (`UUID`, Foreign Key): Associated job record.
* `event_type` (`String`): System state transition tag (e.g. `job_created`, `processing_started`).
* `timestamp` (`DateTime`): Log timestamp.
* `details` (`JSONB`): Context metadata parameters (e.g., retry count down, task IDs).

---

## 8. Job Lifecycle

```
    [ Operator ]              [ API ]              [ Database ]            [ Worker ]
         |                       |                       |                      |
         |--- Create Job ------->|                       |                      |
         |    (payload, retries) |--- Insert Job (queued)|                      |
         |                       |--- Log job_created -->|                      |
         |                       |--- Dispatch task ---->|                      |
         |                       |--- Log dispatched --->|                      |
         |                       |                       |                      |
         |                       |<-- Pick up task ------+----------------------|
         |                       |                       |--- Log processing -->|
         |                       |                       |                      |
         |                       |                       |                      |
         |                       |                       |                      |
         |                       |<-- Run complete (OK) -+----------------------|
         |                       |                       |--- Log completed --->|
         |                       |                                              |
         |                       |                       |                      |
         |                       |                       |                      |
         |                       |<-- Run fail (Error) --+----------------------|
         |                       |                       |--- Log failure ----->|
         |                       |-- Retries remain? --->|                      |
         |                       |   YES: Schedule retry |                      |
         |                       |   NO:  Mark DLQ ------>|                      |
```

---

## 9. Reliability and Retry Strategy

TaskForge uses state-backed retry coordination instead of Celery's transient internal retry mechanism:

1. **Failure Interception**: When a Celery task fails, the handler catches the exception and calls `JobService.mark_job_failed`.
2. **Backoff Calculation**: If the job has not exceeded its retry budget (`attempt_count < 1 + max_retries`), the system schedules a retry with progressive backoff:
   $$\text{Delay (seconds)} = 2^{\text{attempt\_count}}$$
3. **Task Rescheduling**: The job status resets to `queued`, a `next_retry_at` timestamp is set, and a new Celery task is dispatched with a countdown timer matching the delay.
4. **DLQ Transition**: If the execution attempts exceed the budget, the job transitions to `dead_lettered`. The failure reason is saved to `last_error_message` for operator review.
5. **Requeue Flow**: When an operator requeues a job, the system resets `attempt_count` to 0, clears all error fields, transitions the status back to `queued`, and dispatches a new task run.

---

## 10. Real-time Monitoring

Real-time monitoring is implemented via Redis Pub/Sub:

1. **State Transition**: State updates in `JobService` publish an event to Redis channel `taskforge:job_events` using a Pydantic `RealtimeEvent` envelope:
   ```json
   {
     "event_type": "job.processing",
     "timestamp": "2026-07-05T13:10:00Z",
     "job_id": "8a32a67e-4074-4b53-bdf2-f8c6b7ee8a1e",
     "queue_name": "default",
     "status": "processing",
     "attempt_count": 1,
     "data": { "celery_task_id": "b320d912-fa82-411a-bc01-e23a41ef73bc" }
   }
   ```
2. **Event Broker**: The FastAPI process runs a background listener (`redis_event_listener`) that subscribes to the channel.
3. **WebSocket Broadcast**: Received events are parsed and broadcasted to all connected clients on `/ws/dashboard`.
4. **Client Sync**: The Next.js dashboard uses this stream to update the UI and trigger background table refreshes.

---

## 11. Dashboard Structure

The frontend is intentionally designed as a control plane rather than a marketing UI. It supports three primary operator workflows:

### 1. Dispatch and Observe Jobs
From the dashboard header / dispatch modal, an operator can enqueue a new `demo_sleep` or `demo_fail` job, choose a queue, provide a JSON payload, and set a retry budget.

### 2. Investigate Job Execution
The `/jobs` and `/jobs/[id]` pages allow operators to inspect:
- current job state
- payload and result data
- per-attempt execution history
- failure messages
- chronological lifecycle events

### 3. Recover Failed Work
The `/dead-letter` page exposes dead-lettered jobs and allows operators to requeue them after inspection.

---

## 12. API Routes

| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| **POST** | `/api/v1/jobs/` | Creates and dispatches a new job. |
| **GET** | `/api/v1/jobs/` | Lists jobs with pagination and status/queue filtering. |
| **GET** | `/api/v1/jobs/{job_id}` | Retrieves detailed job metadata, attempts, and events. |
| **POST** | `/api/v1/jobs/{job_id}/requeue` | Requeues a dead-lettered job. |
| **GET** | `/api/v1/queues/` | Returns job status statistics grouped by queue. |
| **WS** | `/ws/dashboard` | WebSocket stream for real-time event updates. |

---

## 13. Project Structure

```
TaskForge/
├── docker-compose.yml     # Infrastructure setup (Postgres + Redis)
├── .env.example           # Shared configuration template
├── docs/
│   └── architecture.md    # Detailed system architecture document
├── backend/
│   ├── app/
│   │   ├── api/           # Router endpoints
│   │   ├── core/          # DB config, events, WebSocket manager
│   │   ├── models/        # SQLAlchemy database models
│   │   ├── schemas/       # Pydantic validation schemas
│   │   ├── services/      # Job service and reliability logic
│   │   └── tasks.py       # Celery task definitions
│   └── alembic/           # Alembic database migrations
└── frontend/
    ├── src/
    │   ├── app/           # App Router pages and page layouts
    │   ├── components/    # Reusable UI components
    │   └── lib/           # Fetch wrappers and WS clients
    └── .env.local         # Frontend configuration config
```

---

## 14. Local Setup

### Prerequisites
* Docker and Docker Compose
* Python 3.12+
* Node.js 18+

### Step 1: Run Infrastructure
1. Copy the configuration file:
   ```bash
   cp .env.example .env
   ```
2. Start PostgreSQL and Redis:
   ```bash
   docker compose up -d
   ```

### Step 2: Configure and Start the Backend
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run database migrations:
   ```bash
   alembic upgrade head
   ```
3. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Step 3: Configure and Start the Celery Worker
1. Open a new terminal session, navigate to the backend directory, and activate the virtual environment:
   ```bash
   cd backend
   source .venv/bin/activate
   ```
2. Start the Celery worker process:
   ```bash
   celery -A app.celery_app.celery_app worker --loglevel=info -Q default,high,celery --pool solo
   ```

### Step 4: Configure and Start the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 15. Demo Workflows

### 1. Happy Path Execution
* Click **Dispatch Job** in the header.
* Select `demo_sleep`, set the payload to `{"duration": 5}`, and submit the job.
* Watch the status update in real-time on the dashboard from `queued` to `processing` and then to `completed`.

### 2. Failure Handling and Retries
* Click **Dispatch Job**.
* Select `demo_fail`, set `max_retries` to `2`, and submit.
* Open the job details view by clicking its ID.
* Observe the attempts table and timeline log retries at progressive intervals (2s, 4s). Once retries are exhausted, the job transitions to `dead_lettered`.

### 3. Requeue and Recovery
* Open the **Dead Letter** page.
* Locate the failed `demo_fail` job and click **Requeue**.
* The job transitions back to `queued`, executes once more, and restarts its retry loop.

---

## 16. What This Project Demonstrates

 TaskForge was built as a backend/system-design flagship project and demonstrates:

- **Asynchronous background job execution** using Celery workers and Redis queues
- **Durable state modeling** where PostgreSQL, not the broker, acts as the source of truth for job lifecycle state
- **Retry orchestration and dead-letter handling** with explicit persisted attempt tracking
- **Operational observability** through timeline events, per-attempt history, and realtime dashboard updates
- **Realtime event streaming** using Redis Pub/Sub and FastAPI WebSocket broadcasting
- **Operator tooling / control-plane design** for dispatching, inspecting, and recovering background work
- **Containerized local infrastructure** using Docker Compose for reproducible development setup

---

## 17. Future Improvements

* **Priority Queuing**: Support scheduling task execution using broker priority lanes.
* **Autoscaling Workers**: Configure Celery process pools to scale based on queue depth metrics.
* **Role-Based Auth**: Secure API endpoints and control actions using OAuth2.
* **Payload Storage**: Offload large task payloads and results to S3 storage.

---

## Author
Anshuman Mehta
