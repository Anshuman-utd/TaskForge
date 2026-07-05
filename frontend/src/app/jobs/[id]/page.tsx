"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { JobDetail } from "@/lib/types";
import { formatTimestamp, formatDuration } from "@/lib/formatters";

export default function JobDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequeueing, setIsRequeueing] = useState(false);

  const loadJobDetails = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.fetchJobDetail(id);
      setJob(res);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load job details.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadJobDetails(true);
    }
  }, [id]);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((event) => {
      // Real-time update check
      if (event.job_id === id) {
        loadJobDetails(false);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [id]);

  const handleRequeue = async () => {
    setIsRequeueing(true);
    try {
      await api.requeueJob(id);
      await loadJobDetails(true);
    } catch (e: any) {
      alert(`Failed to requeue job: ${e.message}`);
    } finally {
      setIsRequeueing(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Job Inspector">
        <Loader text="Observing job execution logs..." size="lg" />
      </AppLayout>
    );
  }

  if (error || !job) {
    return (
      <AppLayout title="Job Inspector">
        <EmptyState 
          title="Job not found" 
          description={error || "The requested job record does not exist."} 
          action={<Button onClick={() => router.push("/jobs")}>Back to Explorer</Button>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Job / ${job.id.substring(0, 8)}`}>
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => router.push("/jobs")} 
          className="text-xs text-muted hover:text-foreground flex items-center space-x-1.5 transition-colors cursor-pointer font-semibold"
        >
          <span>&larr;</span> <span>Back to Explorer</span>
        </button>

        {job.status === "dead_lettered" && (
          <Button 
            variant="primary" 
            size="sm" 
            isLoading={isRequeueing} 
            onClick={handleRequeue}
            className="cursor-pointer"
          >
            Requeue DLQ Job
          </Button>
        )}
      </div>

      {/* Top Grid: Info & Identifiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 border-l-4 border-l-zinc-500" title="Job Information" subtitle="System variables and metadata parameters">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-xs mt-2">
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Status</div>
              <div className="mt-1">
                <StatusBadge status={job.status} />
              </div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Job Type</div>
              <div className="font-semibold text-foreground mt-1.5">{job.job_type}</div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Queue</div>
              <div className="text-neutral-300 mt-1.5">{job.queue_name}</div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Celery Task ID</div>
              <div className="font-mono text-neutral-300 mt-1.5 truncate" title={job.celery_task_id || "None"}>
                {job.celery_task_id || "-"}
              </div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Attempts</div>
              <div className="text-neutral-300 mt-1.5 font-mono">{job.attempt_count} / {job.max_retries} max</div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Created At</div>
              <div className="text-neutral-400 font-mono mt-1.5 text-[11px]">{formatTimestamp(job.created_at)}</div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Started At</div>
              <div className="text-neutral-400 font-mono mt-1.5 text-[11px]">{formatTimestamp(job.started_at)}</div>
            </div>
            <div>
              <div className="text-muted font-mono uppercase text-[9px] tracking-wide">Completed / Terminated</div>
              <div className="text-neutral-400 font-mono mt-1.5 text-[11px]">{formatTimestamp(job.completed_at)}</div>
            </div>
            {job.next_retry_at && (
              <div>
                <div className="text-muted font-mono uppercase text-[9px] tracking-wide text-amber-500">Next Retry scheduled</div>
                <div className="text-amber-400 font-mono mt-1.5 text-[11px]">{formatTimestamp(job.next_retry_at)}</div>
              </div>
            )}
            {job.dead_lettered_at && (
              <div>
                <div className="text-muted font-mono uppercase text-[9px] tracking-wide text-rose-500">Dead lettered at</div>
                <div className="text-rose-400 font-mono mt-1.5 text-[11px]">{formatTimestamp(job.dead_lettered_at)}</div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col space-y-4">
          <Card className="flex-1" title="Identifiers" subtitle="UUID properties">
            <div className="space-y-3 font-mono text-[11px] mt-2">
              <div>
                <div className="text-[9px] text-muted uppercase">Database UUID</div>
                <div className="text-neutral-300 select-all mt-0.5 p-1 bg-neutral-900 border border-border rounded">{job.id}</div>
              </div>
              {job.celery_task_id && (
                <div>
                  <div className="text-[9px] text-muted uppercase">Broker task ID</div>
                  <div className="text-neutral-300 select-all mt-0.5 p-1 bg-neutral-900 border border-border rounded">{job.celery_task_id}</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Error banner if present */}
      {job.last_error_message && (
        <div className="mb-6 p-4 rounded bg-rose-950/20 border border-rose-900/60 text-xs font-mono text-rose-450 select-text leading-relaxed">
          <div className="font-bold text-[10px] uppercase text-rose-500 mb-1.5">Last Caught Execution Error</div>
          {job.last_error_message}
        </div>
      )}

      {/* Payloads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <CodeBlock data={job.payload} title="Execution Request Payload" />
        <CodeBlock data={job.result} title="Execution Response Result" />
      </div>

      {/* Attempts & Logs */}
      <div className="space-y-6">
        <Card title="Execution Attempts" subtitle="Step-by-step retry audit database records">
          {(!job.attempts || job.attempts.length === 0) ? (
            <div className="text-xs font-mono text-neutral-500 italic py-2">
              No active execution attempts recorded for this job.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Num</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Finished At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.attempts.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-mono text-neutral-300">{att.attempt_number}</TableCell>
                    <TableCell>
                      <StatusBadge status={att.status} />
                    </TableCell>
                    <TableCell className="font-mono text-neutral-400 text-[11px] truncate max-w-[120px]" title={att.celery_task_id || "None"}>
                      {att.celery_task_id ? att.celery_task_id.substring(0, 8) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-neutral-400 text-[11px]">{formatTimestamp(att.started_at)}</TableCell>
                    <TableCell className="font-mono text-neutral-400 text-[11px]">{formatTimestamp(att.finished_at)}</TableCell>
                    <TableCell className="font-mono text-neutral-400 text-[11px]">{formatDuration(att.duration_ms)}</TableCell>
                    <TableCell className="font-mono text-rose-450 text-[11px] max-w-[200px] truncate" title={att.error_message || ""}>
                      {att.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Auditing Trace Timeline */}
        <Card title="Control Plane Observability Trail" subtitle="Database timeline events and trace metadata records">
          {(!job.events || job.events.length === 0) ? (
            <div className="text-xs font-mono text-neutral-500 italic py-2">
              No audit events logged for this job.
            </div>
          ) : (
            <div className="py-4 pl-2 pr-4 bg-neutral-950 border border-border rounded-lg shadow-inner">
              <div className="relative border-l border-neutral-800 pl-6 ml-6 space-y-6">
                {job.events.map((ev) => {
                  let dotColor = "bg-zinc-500 shadow-zinc-500/10";
                  let textColor = "text-neutral-400";
                  
                  if (ev.event_type.includes("create") || ev.event_type.includes("dispatch")) {
                    dotColor = "bg-blue-500 shadow-blue-500/20";
                    textColor = "text-blue-400";
                  } else if (ev.event_type.includes("started") || ev.event_type.includes("schedule")) {
                    dotColor = "bg-amber-500 shadow-amber-500/20";
                    textColor = "text-amber-400";
                  } else if (ev.event_type.includes("completed")) {
                    dotColor = "bg-emerald-500 shadow-emerald-500/20";
                    textColor = "text-emerald-400";
                  } else if (ev.event_type.includes("failed") || ev.event_type.includes("dead")) {
                    dotColor = "bg-rose-500 shadow-rose-500/20";
                    textColor = "text-rose-400";
                  } else if (ev.event_type.includes("requeue")) {
                    dotColor = "bg-violet-500 shadow-violet-500/20";
                    textColor = "text-violet-400";
                  }

                  return (
                    <div key={ev.id} className="relative">
                      {/* Timeline Bullet node */}
                      <span className="absolute -left-[30px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-950 border border-border z-10">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`}></span>
                      </span>
                      
                      {/* Event header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-900/60 pb-1.5">
                        <span className={`font-mono text-xs font-bold ${textColor}`}>
                          {ev.event_type}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-mono mt-1 sm:mt-0">
                          {formatTimestamp(ev.timestamp)}
                        </span>
                      </div>
                      
                      {/* Details data */}
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <div className="mt-2 max-w-full">
                          <pre className="text-[10px] font-mono text-neutral-500 bg-neutral-900/30 p-2.5 rounded border border-neutral-900/60 overflow-x-auto whitespace-pre-wrap break-all max-h-48 leading-relaxed">
                            {JSON.stringify(ev.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
