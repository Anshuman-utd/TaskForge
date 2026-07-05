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
          className="text-xs text-muted hover:text-foreground flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <span>&larr;</span> <span>Back to Explorer</span>
        </button>

        {job.status === "dead_lettered" && (
          <Button 
            variant="primary" 
            size="sm" 
            isLoading={isRequeueing} 
            onClick={handleRequeue}
          >
            Requeue DLQ Job
          </Button>
        )}
      </div>

      {/* Top Grid: Info & Identifiers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2" title="Job Information" subtitle="System variables and metadata parameters">
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
              <div className="text-neutral-300 mt-1.5">{job.attempt_count} / {job.max_retries} max</div>
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
                <div className="text-neutral-300 select-all mt-0.5">{job.id}</div>
              </div>
              {job.celery_task_id && (
                <div>
                  <div className="text-[9px] text-muted uppercase">Broker task ID</div>
                  <div className="text-neutral-300 select-all mt-0.5">{job.celery_task_id}</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Error banner if present */}
      {job.last_error_message && (
        <div className="mb-6 p-4 rounded bg-rose-950/20 border border-rose-900/60 text-xs font-mono text-rose-400 select-text leading-relaxed">
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
                    <TableCell className="font-mono text-rose-400 text-[11px] max-w-[200px] truncate" title={att.error_message || ""}>
                      {att.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Database Audit Events" subtitle="Chronological write timeline logs">
          {(!job.events || job.events.length === 0) ? (
            <div className="text-xs font-mono text-neutral-500 italic py-2">
              No audit events logged for this job.
            </div>
          ) : (
            <div className="border border-border rounded bg-card/30 p-4 space-y-4">
              {job.events.map((ev) => {
                let badgeColor = "bg-neutral-800 text-neutral-400";
                if (ev.event_type.includes("create")) badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                if (ev.event_type.includes("started")) badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                if (ev.event_type.includes("completed")) badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                if (ev.event_type.includes("failed") || ev.event_type.includes("dead")) badgeColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                return (
                  <div key={ev.id} className="flex items-start space-x-4 border-b border-neutral-900/60 pb-3 last:border-b-0 last:pb-0">
                    <div className="shrink-0 font-mono text-[10px] text-neutral-500 w-36 pt-0.5">
                      {formatTimestamp(ev.timestamp)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium ${badgeColor}`}>
                        {ev.event_type}
                      </span>
                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <pre className="text-[10px] font-mono text-neutral-500 bg-neutral-950 p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap max-w-full">
                          {JSON.stringify(ev.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
