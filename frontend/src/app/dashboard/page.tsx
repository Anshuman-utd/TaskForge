"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { LiveEventsFeed } from "@/components/dashboard/LiveEventsFeed";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { Job, QueueStatsItem } from "@/lib/types";
import { formatTimestamp, truncateId } from "@/lib/formatters";
import { PlusIcon } from "@/components/icons";
import { DispatchJobModal } from "@/components/dashboard/DispatchJobModal";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStatsItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        api.fetchQueueStats(),
        api.fetchJobs({ page: 1, size: 5 })
      ]);
      setQueueStats(statsRes.items);
      setRecentJobs(jobsRes.items);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load dashboard data.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const unsubscribe = wsClient.subscribe(() => {
      // Light update when any WS event triggers
      loadData(false);
    });

    // Also listen to manual dispatches from Header
    window.addEventListener("job-dispatched", () => {
      loadData(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("job-dispatched", () => {});
    };
  }, []);

  const summary = queueStats.reduce(
    (acc, curr) => {
      acc.queued += curr.queued;
      acc.processing += curr.processing;
      acc.completed += curr.completed;
      acc.failed += curr.failed;
      acc.dead_lettered += curr.dead_lettered;
      return acc;
    },
    { queued: 0, processing: 0, completed: 0, failed: 0, dead_lettered: 0 }
  );

  const totalJobs =
    summary.queued +
    summary.processing +
    summary.completed +
    summary.failed +
    summary.dead_lettered;

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <Loader text="Loading operator control panel..." size="lg" />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Dashboard">
        <EmptyState 
          title="Dashboard unavailable" 
          description={error} 
          action={
            <button onClick={() => loadData(true)} className="px-4 py-2 border border-border rounded text-xs hover:bg-neutral-800 transition-colors cursor-pointer font-semibold text-neutral-200">
              Retry Connection
            </button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard Summary">
      {/* Overview Context and CTA Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-border mb-6">
        <div>
          <h2 className="text-xs font-semibold text-neutral-300">Control Plane Aggregates</h2>
          <p className="text-[10px] text-muted font-mono mt-0.5">Live totals calculated from database allocations</p>
        </div>
      </div>

      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <Card className="border-t-2 border-t-zinc-500 hover:border-zinc-700 transition-all duration-200 cursor-default">
          <div className="text-[9px] font-mono text-muted uppercase tracking-wider">Total Jobs</div>
          <div className="text-2xl font-bold mt-1 text-zinc-100">{totalJobs}</div>
        </Card>
        <Card className="border-t-2 border-t-blue-500 hover:border-zinc-700 transition-all duration-200 cursor-default">
          <div className="text-[9px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>Queued</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-400">{summary.queued}</div>
        </Card>
        <Card className="border-t-2 border-t-amber-500 hover:border-zinc-700 transition-all duration-200 cursor-default">
          <div className="text-[9px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            <span>Processing</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{summary.processing}</div>
        </Card>
        <Card className="border-t-2 border-t-emerald-500 hover:border-zinc-700 transition-all duration-200 cursor-default">
          <div className="text-[9px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Completed</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{summary.completed}</div>
        </Card>
        <Card className="border-t-2 border-t-rose-500 hover:border-zinc-700 transition-all duration-200 cursor-default">
          <div className="text-[9px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            <span>Dead Lettered</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-400">{summary.dead_lettered}</div>
        </Card>
      </div>

      {/* 2. Main content splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left section: tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity Table */}
          <Card title="Recent Activity" subtitle="Most recently enqueued execution runs">
            {recentJobs.length === 0 ? (
              <EmptyState 
                title="No jobs recorded" 
                description="Click 'Dispatch New Job' above to submit a test run." 
                action={
                  <Button size="sm" variant="primary" onClick={() => setIsDispatchModalOpen(true)}>
                    Dispatch Job
                  </Button>
                }
              />
            ) : (
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
                  {recentJobs.map((job) => (
                    <TableRow 
                      key={job.id} 
                      className="cursor-pointer hover:bg-neutral-800/40 transition-colors"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                    >
                      <TableCell className="font-mono text-blue-400 font-bold">
                        {truncateId(job.id)}
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
            )}
          </Card>

          {/* Active Queue Backlogs Table */}
          <Card title="Active Queue Backlogs" subtitle="Allocated queue metrics and state splits">
            {queueStats.length === 0 ? (
              <EmptyState title="No active queues" description="Submit a job to allocate broker queues." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queue Name</TableHead>
                    <TableHead>Queued</TableHead>
                    <TableHead>Processing</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Dead-Lettered</TableHead>
                    <TableHead>Failed (Legacy)</TableHead>
                    <TableHead className="text-right">Total Allocation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueStats.map((q) => {
                    const qTotal = q.queued + q.processing + q.completed + q.failed + q.dead_lettered;
                    return (
                      <TableRow key={q.queue_name}>
                        <TableCell className="font-semibold text-foreground">{q.queue_name}</TableCell>
                        <TableCell className="font-semibold font-mono text-blue-400">{q.queued}</TableCell>
                        <TableCell className="font-semibold font-mono text-amber-400">{q.processing}</TableCell>
                        <TableCell className="font-semibold font-mono text-emerald-400">{q.completed}</TableCell>
                        <TableCell className="font-semibold font-mono text-rose-400">{q.dead_lettered}</TableCell>
                        <TableCell className="font-semibold font-mono text-orange-400">{q.failed}</TableCell>
                        <TableCell className="font-mono text-neutral-300 text-right font-semibold">{qTotal}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        {/* Right section: log timeline */}
        <div className="space-y-6">
          <LiveEventsFeed />
        </div>
      </div>

      {/* Modal placement */}
      <DispatchJobModal 
        isOpen={isDispatchModalOpen} 
        onClose={() => setIsDispatchModalOpen(false)}
        onSuccess={() => loadData(false)}
      />
    </AppLayout>
  );
}
