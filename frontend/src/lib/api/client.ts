import { Job, JobDetail, JobPageResponse, QueueStatsResponse } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        errorMsg = errBody.detail;
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  async fetchJobs(params?: {
    status?: string;
    queue_name?: string;
    job_type?: string;
    page?: number;
    size?: number;
  }): Promise<JobPageResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.status) query.set("status", params.status);
      if (params.queue_name) query.set("queue_name", params.queue_name);
      if (params.job_type) query.set("job_type", params.job_type);
      if (params.page) query.set("page", params.page.toString());
      if (params.size) query.set("size", params.size.toString());
    }
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return request<JobPageResponse>(`/api/v1/jobs/${queryString}`);
  },

  async fetchJobDetail(id: string): Promise<JobDetail> {
    return request<JobDetail>(`/api/v1/jobs/${id}`);
  },

  async requeueJob(id: string): Promise<Job> {
    return request<Job>(`/api/v1/jobs/${id}/requeue`, {
      method: "POST",
    });
  },

  async fetchQueueStats(): Promise<QueueStatsResponse> {
    return request<QueueStatsResponse>("/api/v1/queues/");
  },

  async createJob(
    job_type: string,
    queue_name: string = "default",
    payload: Record<string, any> = {},
    max_retries: number = 3
  ): Promise<Job> {
    return request<Job>("/api/v1/jobs/", {
      method: "POST",
      body: JSON.stringify({
        job_type,
        queue_name,
        payload,
        max_retries,
      }),
    });
  },
};
