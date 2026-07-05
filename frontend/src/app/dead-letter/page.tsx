"use client";
import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { Job } from "@/lib/types";
import { formatTimestamp, truncateId } from "@/lib/formatters";
import Link from "next/link";

export default function DeadLetterPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningJobId, setActioningJobId] = useState<string | null>(null);

  const loadDlqJobs = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.fetchJobs({
        status: "dead_lettered",
        page: 1,
        size: 100, // DLQ limit cap
      });
      setJobs(res.items);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load dead letter queue.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadDlqJobs(true);

    const unsubscribe = wsClient.subscribe(() => {
      // Light update
      loadDlqJobs(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRequeue = async (id: string) => {
    setActioningJobId(id);
    try {
      await api.requeueJob(id);
      await loadDlqJobs(false);
    } catch (e: any) {
      alert(`Failed to requeue job: ${e.message}`);
    } finally {
      setActioningJobId(null);
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <AppLayout title="Dead Letter Queue">
        <Loader text="Querying dead letter queue..." size="lg" />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Dead Letter Queue">
        <EmptyState 
          title="DLQ Load Failure" 
          description={error} 
          action={<Button onClick={() => loadDlqJobs(true)}>Retry Query</Button>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dead Letter Queue">
      <Card title="DLQ Control Center" subtitle="Review failing jobs that have exhausted all retries and require operator intervention">
        {jobs.length === 0 ? (
          <EmptyState 
            title="DLQ is clean" 
            description="No dead-lettered jobs found. All orchestrations are executing cleanly or resolving within retry thresholds." 
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Dead-Lettered At</TableHead>
                <TableHead>Last Error Message</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-neutral-300">
                    <Link href={`/jobs/${job.id}`} className="hover:underline text-blue-400 font-semibold">
                      {truncateId(job.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{job.job_type}</TableCell>
                  <TableCell className="text-muted">{job.queue_name}</TableCell>
                  <TableCell className="font-mono text-neutral-400">{job.attempt_count} / {job.max_retries}</TableCell>
                  <TableCell className="text-muted text-[11px]">{formatTimestamp(job.dead_lettered_at)}</TableCell>
                  <TableCell className="font-mono text-rose-450 text-[11px] max-w-[200px] truncate" title={job.last_error_message || ""}>
                    {job.last_error_message || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      isLoading={actioningJobId === job.id} 
                      onClick={() => handleRequeue(job.id)}
                      className="text-[10px] font-semibold py-1 px-2.5 cursor-pointer"
                    >
                      Requeue
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
