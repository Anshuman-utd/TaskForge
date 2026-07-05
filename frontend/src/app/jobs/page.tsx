"use client";
import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { Job } from "@/lib/types";
import { formatTimestamp, truncateId } from "@/lib/formatters";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import Link from "next/link";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [status, setStatus] = useState<string>("");
  const [queue, setQueue] = useState<string>("");
  const [jobType, setJobType] = useState<string>("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const loadJobs = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.fetchJobs({
        page,
        size: pageSize,
        status: status || undefined,
        queue_name: queue || undefined,
        job_type: jobType || undefined,
      });
      setJobs(res.items);
      setTotalPages(res.pages);
      setTotalCount(res.total);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load jobs list.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs(true);
  }, [page, status, queue, jobType]);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe(() => {
      // Background update
      loadJobs(false);
    });
    return () => {
      unsubscribe();
    };
  }, [page, status, queue, jobType]);

  const handleResetFilters = () => {
    setStatus("");
    setQueue("");
    setJobType("");
    setPage(1);
  };

  return (
    <AppLayout title="Jobs Explorer">
      {/* Filters Card */}
      <Card className="mb-6" title="Explorer Filters" subtitle="Search and segment orchestration pipelines">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          {/* Status select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-mono text-muted uppercase">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-neutral-500"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="dead_lettered">Dead Lettered</option>
            </select>
          </div>

          {/* Queue Name */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-mono text-muted uppercase">Queue Name</label>
            <input
              type="text"
              placeholder="e.g. default"
              value={queue}
              onChange={(e) => { setQueue(e.target.value); setPage(1); }}
              className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Job Type */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-mono text-muted uppercase">Job Type</label>
            <input
              type="text"
              placeholder="e.g. demo_sleep"
              value={jobType}
              onChange={(e) => { setJobType(e.target.value); setPage(1); }}
              className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Reset */}
          <Button size="md" variant="secondary" onClick={handleResetFilters}>
            Reset Explorer
          </Button>
        </div>
      </Card>

      {/* Main Grid */}
      {loading && jobs.length === 0 ? (
        <Loader text="Querying execution logs..." size="lg" />
      ) : error ? (
        <EmptyState 
          title="Query failure" 
          description={error} 
          action={<Button onClick={() => loadJobs(true)}>Retry Query</Button>}
        />
      ) : jobs.length === 0 ? (
        <EmptyState 
          title="No jobs found" 
          description="Try relaxing your filter parameters or dispatch a new job run." 
          action={(status || queue || jobType) ? <Button onClick={handleResetFilters}>Clear Filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Created At</TableHead>
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
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="font-mono text-neutral-400">{job.attempt_count} / {job.max_retries}</TableCell>
                  <TableCell className="text-muted text-[11px]">{formatTimestamp(job.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted">
              Showing <span className="font-semibold text-neutral-200">{jobs.length}</span> of{" "}
              <span className="font-semibold text-neutral-200">{totalCount}</span> total jobs
            </span>

            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                <ChevronLeftIcon size={14} className="mr-1" />
                Previous
              </Button>
              <span className="text-xs font-mono text-muted">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRightIcon size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
