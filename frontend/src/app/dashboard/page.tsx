"use client";
import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveEventsFeed } from "@/components/dashboard/LiveEventsFeed";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { Job, QueueStatsItem } from "@/lib/types";
import { formatTimestamp, truncateId } from "@/lib/formatters";
import Link from "next/link";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStatsItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);

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

    return () => {
      unsubscribe();
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
            <button onClick={() => loadData(true)} className="px-4 py-2 border border-border rounded text-xs hover:bg-neutral-800 transition-colors">
              Retry Connection
            </button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard Summary">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider">Total Jobs</div>
          <div className="text-2xl font-bold mt-1 text-foreground">{totalJobs}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>Queued</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-400">{summary.queued}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            <span>Processing</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{summary.processing}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Completed</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{summary.completed}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider flex items-center space-x-1.5">
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
          <Card title="Recent Activity" subtitle="Most recently enqueued execution runs">
            {recentJobs.length === 0 ? (
              <EmptyState title="No jobs recorded" description="Submit a test run using the action buttons in the header." />
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
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-neutral-300">
                        <Link href={`/jobs/${job.id}`} className="hover:underline text-blue-400">
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
            )}
          </Card>

          <Card title="Active Queue Backlogs" subtitle="Queue size pressure metrics">
            {queueStats.length === 0 ? (
              <EmptyState title="No active queues" description="Submit a job to initialize a target queue." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {queueStats.map((q) => {
                  const qTotal = q.queued + q.processing + q.completed + q.failed + q.dead_lettered;
                  return (
                    <div key={q.queue_name} className="border border-border rounded p-4 bg-neutral-900/30">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <span className="font-semibold text-foreground text-xs">{q.queue_name}</span>
                        <span className="text-[10px] font-mono text-muted">{qTotal} jobs total</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div>
                          <div className="text-[9px] font-mono text-muted uppercase">Queued</div>
                          <div className="text-sm font-semibold text-blue-400 mt-0.5">{q.queued}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-muted uppercase">Processing</div>
                          <div className="text-sm font-semibold text-amber-400 mt-0.5">{q.processing}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-muted uppercase">DLQ</div>
                          <div className="text-sm font-semibold text-rose-400 mt-0.5">{q.dead_lettered}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right section: log timeline */}
        <div className="space-y-6">
          <LiveEventsFeed />
        </div>
      </div>
    </AppLayout>
  );
}
