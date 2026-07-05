# TaskForge System Architecture

This document describes the end-to-end architecture, database schema layout, runtime lifecycle flows, and core design decisions of the TaskForge distributed job orchestration platform and control plane.

---

## 1. System Topology

TaskForge is structured as a decoupled architecture where the API server, database storage, broker queue, and execution workers scale independently. The state of all asynchronous workflows is backed by a transactional relational database, which serves as the single source of truth.

### Detailed Architecture Diagram

```
+-----------------------------------------------------------------------------------------+
|                               OPERATOR / BROWSER CLIENT                                 |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  |                            Next.js Control Dashboard                              |  |
|  |                                                                                   |  |
|  |  +--------------------+  +--------------------+  +-----------------------------+  |  |
|  |  |   Summary Cards    |  |   Queues / Jobs    |  |     Live events console     |  |  |
|  |  | (Queued/Proc/DLQ)  |  |      Explorer      |  |  (Live log WebSocket feed)  |  |  |
|  |  +--------------------+  +--------------------+  +-----------------------------+  |  |
|  |            ^                      ^                               ^               |  |
|  |            |                      |                               |               |  |
|  |            | REST Query           | REST Create / Requeue         | WebSocket     |  |
|  +------------+----------------------+-------------------------------+---------------+  |
+---------------|----------------------|-------------------------------|------------------+
                |                      |                               |
                |                      |                               |
+---------------v----------------------v-------------------------------|------------------+
|                                  FASTAPI BACKEND                     v                  |
|                                                                                         |
|  +-------------------------------------------------------+   +-----------------------+  |
|  |                    REST API Endpoints                 |   |  WebSocket Endpoint   |  |
|  |                                                       |   |                       |  |
|  |   - GET  /api/v1/queues     - POST /api/v1/jobs       |   |   /ws/dashboard       |  |
|  |   - GET  /api/v1/jobs       - POST /api/v1/jobs/:id/  |   |                       |  |
|  |   - GET  /api/v1/jobs/:id          requeue            |   |   (Broadcaster using  |  |
|  +-------------------------------------------------------+   |    WebsocketManager)  |  |
|                              |                               +-----------------------+  |
|                              v                                           ^              |
|              +-------------------------------+                           |              |
|              |      Job Service Layer        |                           | Reads        |
|              |                               |                           | events       |
|              |  - create_job / dispatch_job  |                           |              |
|              |  - mark_job_processing /      |                           |              |
|              |    mark_job_completed /       |                           |              |
|              |    mark_job_failed /          |                           |              |
|              |    requeue_job                |                           |              |
|              +-------------------------------+                           |              |
|                 /            |             \                             |              |
|   SQL Queries  /             |              \ Celery tasks               |              |
|  and Updates  /              |               \ dispatched                |              |
|              v               |                v                          |              |
|      +---------------+       |       +-------------------+       +---------------+      |
|      |  PostgreSQL   |       |       | Redis Task Broker |       |  Redis Event  |      |
|      |  Database     |       |       | (Celery Queue)    |       |  Listener     |      |
|      |               |       |       |                   |       |               |      |
|      | - jobs        |       |       +-------------------+       | (Subscribes to|      |
|      | - attempts    |       |                 |                 |  Redis Pub/Sub|      |
|      | - events      |       |                 v                 |  channel)     |      |
|      +---------------+       |       +-------------------+       +---------------+      |
|              ^               |       |  Celery Workers   |               ^              |
|              |               |       |                   |               |              |
|              |               |       |  - demo_sleep     |               |              |
|              |               |       |  - demo_fail      |               |              |
|              |               |       +-------------------+               |              |
|              |               |                 |                         |              |
|              +---------------+-----------------+-------------------------+              |
|                Worker updates status and publishes lifecycle events to                 |
|                     Redis Pub/Sub ("taskforge:job_events")                              |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Runtime Execution Flows

### 2.1 Job Creation & Dispatch Flow

1. The client issues a `POST /api/v1/jobs` request containing `job_type`, `queue_name`, `payload`, and `max_retries`.
2. The `JobService` layer opens a database transaction:
   * Inserts a record into the `jobs` table with a state of `queued`.
   * Inserts a transition record into the `job_events` table representing `job_created`.
   * Commits the transaction.
3. Once the database transaction is committed, `JobService` publishes a `job_created` event message to the Redis Pub/Sub channel.
4. `JobService` verifies if the `job_type` maps to a registered worker task handler. If supported, it calls `celery_app.send_task(...)` to publish a message onto the broker queue.
5. The API updates the job's `celery_task_id`, logs a `job_dispatched` event in the `job_events` table, and publishes a `job.dispatched` payload to the Redis Pub/Sub channel.

### 2.2 Worker Execution Flow

1. An idle Celery worker thread pulls the task message from the Redis broker.
2. Upon picking up the job, the worker task thread opens a database session and transitions the status:
   * Updates the `status` of the job to `processing` in the `jobs` table and sets the `started_at` timestamp.
   * Inserts a record into the `job_attempts` table tracking the active execution attempt.
   * Logs a `processing_started` transition in `job_events`.
   * Publishes a `job.processing` real-time message to Redis Pub/Sub.
3. The worker executes the task's business logic.
4. **Happy Path**: Upon successful completion, the task thread:
   * Sets the job's `status` to `completed` and sets the `completed_at` timestamp.
   * Persists the returned data dictionary to `result_json` in the database.
   * Updates the matching `job_attempts` record to `completed`, computing the execution duration.
   * Logs a `completed` event to `job_events`.
   * Publishes a `job.completed` update to Redis Pub/Sub.

### 2.3 Retry, Backoff, & Dead-Lettering (DLQ) Flow

1. **Failure Catch**: If the worker execution raises a runtime exception, the task catches the error.
2. The task thread transitions the active attempt in `job_attempts` to `failed` and records the error traceback.
3. The thread records an `attempt_failed` event in `job_events` and publishes a `job.failed` event to Redis Pub/Sub.
4. **Evaluation**: The system checks if `attempt_count < 1 + max_retries`:
   * **Case A (Retries Available)**:
     * Calculates the exponential backoff:
       $$\text{Delay} = 2^{\text{attempt\_count}} \text{ seconds}$$
     * Updates the job state to `queued` and computes `next_retry_at`.
     * Logs a `retry_scheduled` event in the database and publishes it to Redis Pub/Sub.
     * Enqueues a new Celery run passing a `countdown` argument matching the calculated delay.
     * Records a new `job_dispatched` database event and publishes the real-time event.
   * **Case B (Retries Exhausted)**:
     * Updates the job status to `dead_lettered` and sets `dead_lettered_at`.
     * Saves the final error traceback to `last_error_message` on the job record.
     * Logs a `dead_lettered` audit event in `job_events` and publishes a `job.dead_lettered` event to Redis Pub/Sub.

```
                    +------------------------------------+
                    |        Celery Task Starts          |
                    +------------------------------------+
                                      |
                                      v
                    +------------------------------------+
                    |  State set to 'processing'         |
                    |  JobAttempt record inserted        |
                    +------------------------------------+
                                      |
                                      |-- Runs Business Logic
                                      |
                                      v
                            Is Run Successful?
                             /              \
                           YES               NO
                           /                  \
                          v                    v
          +----------------------+     +-----------------------+
          | State: 'completed'   |     | State: 'failed'       |
          | Update JobAttempt    |     | Update JobAttempt     |
          | Log completed event  |     | Log failed event      |
          +----------------------+     +-----------------------+
                                                   |
                                                   v
                                          Is Attempt Count <
                                          (1 + max_retries)?
                                           /              \
                                         YES               NO
                                         /                  \
                                        v                    v
                        +----------------------+     +-----------------------+
                        | Delay = 2^attempts   |     | State: 'dead_lettered'|
                        | State set to 'queued'|     | Save error traceback  |
                        | Re-enqueue with delay|     | Log DLQ event         |
                        +----------------------+     +-----------------------+
```

### 2.4 Requeue Flow

1. An operator requests to recover a job by issuing a `POST /api/v1/jobs/{job_id}/requeue` request.
2. The API layer checks if the job's current status is `dead_lettered`. If not, it rejects the operation.
3. The system resets the job state variables:
   * Sets `status` back to `queued`.
   * Resets `attempt_count` to `0`.
   * Clears `dead_lettered_at`, `last_error_message`, `next_retry_at`, and `result_json`.
4. Logs a `requeued` event in `job_events` and publishes it to Redis Pub/Sub.
5. Re-dispatches the task to the Celery broker, generating a new `celery_task_id` and logging the corresponding `job_dispatched` event.

### 2.5 Real-time Event Broadcast Flow

1. When any lifecycle state transition occurs, the database commits the change.
2. The service calls `publish_job_event`, which serializes a Pydantic `RealtimeEvent` envelope.
3. The event string is published to Redis Pub/Sub on the `taskforge:job_events` channel.
4. A background loop (`redis_event_listener`) running on the FastAPI server reads incoming messages from the Redis channel.
5. The listener parses the message and broadcasts it to all active WebSockets managed by `WebsocketManager`.
6. Dashboard clients receive the event, updating local logs and triggering targeted REST data refetches for page tables.

---

## 3. Database Design Decisions

TaskForge uses three separate tables to balance read performance, query limits, and write-lock isolation.

### Decoupled Job Auditing: Attempts vs. Events

TaskForge splits execution records into two separate entities: `job_attempts` and `job_events`.

* **`job_attempts`**: Holds the structured data of each task execution. This table tracks starting times, completion times, target worker hosts, and failure exceptions. It is optimized for structural audits and calculating runtime metrics.
* **`job_events`**: Serves as a write-only log of database state changes. It provides a linear history of all state changes from creation to completion or dead-lettering, including parameters like scheduler delays.

This separation prevents the `jobs` table from growing large with historical log data and isolates active execution traces from general audit timelines.

### Relational Database as the Source of Truth

TaskForge uses PostgreSQL as the single source of truth for job states. Redis is used only as a message transport broker.

* **Durability**: Using a database avoids losing job status information if a Redis instance restarts or runs out of memory.
* **Consistency**: Relational databases allow transactional consistency across updates. When a worker finishes a task, it updates the job status, inserts the attempt metrics, and writes the audit log in a single transactional block.
* **Access Control**: PostgreSQL supports standard database access patterns for complex queries, pagination, and sorting across millions of historically processed jobs.

---

## 4. Current Limits and Scope

While TaskForge demonstrates reliable asynchronous processing, it operates within the following boundaries:

* **Single-Worker Host Lockouts**: If a worker node crashes mid-execution before writing to the database, the active job remains stuck in `processing`. The system does not currently run a background reaper process to auto-reclaim orphaned tasks.
* **Pub/Sub Delivery Guarantees**: Redis Pub/Sub is an in-memory, at-most-once delivery mechanism. If the FastAPI application restarts, any live event messages published during the window are not buffered or sent to connected WebSockets.
* **Concurrent Transaction Limits**: High throughput can cause database write lock contention on the `jobs` table when many parallel workers update job states simultaneously.