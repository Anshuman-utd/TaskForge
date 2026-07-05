export interface Job {
  id: string;
  job_type: string;
  queue_name: string;
  status: string;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  max_retries: number;
  attempt_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
  dead_lettered_at: string | null;
  last_error_message: string | null;
  celery_task_id: string | null;
}

export interface JobAttempt {
  id: string;
  job_id: string;
  attempt_number: number;
  worker_name: string | null;
  status: string;
  celery_task_id: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface JobEvent {
  id: string;
  job_id: string;
  event_type: string;
  timestamp: string;
  details: Record<string, any> | null;
}

export interface JobDetail extends Job {
  attempts: JobAttempt[];
  events: JobEvent[];
}

export interface JobPageResponse {
  items: Job[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface QueueStatsItem {
  queue_name: string;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  dead_lettered: number;
}

export interface QueueStatsResponse {
  items: QueueStatsItem[];
}

export interface RealtimeEvent {
  event_type: string;
  timestamp: string;
  job_id: string;
  queue_name: string;
  status: string;
  attempt_count: number;
  data: Record<string, any> | null;
}
