"use client";
import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Loader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import { wsClient } from "@/lib/websocket/client";
import { QueueStatsItem } from "@/lib/types";

export default function QueuesPage() {
  const [queues, setQueues] = useState<QueueStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueueStats = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.fetchQueueStats();
      setQueues(res.items);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load queue statistics.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueStats(true);

    const unsubscribe = wsClient.subscribe(() => {
      // Light update
      loadQueueStats(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading && queues.length === 0) {
    return (
      <AppLayout title="Queue Metrics">
        <Loader text="Querying queue statistics..." size="lg" />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Queue Metrics">
        <EmptyState 
          title="Metrics Load Failure" 
          description={error} 
          action={<Button onClick={() => loadQueueStats(true)}>Retry Query</Button>}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Queue Metrics">
      {queues.length === 0 ? (
        <EmptyState 
          title="No queues initialized" 
          description="There are no jobs registered in the database, hence no active queue allocations exist." 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {queues.map((q) => {
            const totalActive = q.queued + q.processing;
            const totalTerminal = q.completed + q.failed + q.dead_lettered;
            const total = totalActive + totalTerminal;

            return (
              <Card key={q.queue_name} title={`Queue: ${q.queue_name}`} subtitle="Workload distribution and pressure statistics">
                {/* Backlog Pressure indicator */}
                <div className="mb-6 mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted mb-1.5 uppercase">
                    <span>Backlog Pressure</span>
                    <span className="font-semibold text-neutral-300">
                      {totalActive} Active / {total} Total
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (q.queued / total) * 100 : 0}%` }}
                      title={`Queued: ${q.queued}`}
                    ></div>
                    <div 
                      className="bg-amber-500 h-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (q.processing / total) * 100 : 0}%` }}
                      title={`Processing: ${q.processing}`}
                    ></div>
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (q.completed / total) * 100 : 0}%` }}
                      title={`Completed: ${q.completed}`}
                    ></div>
                    <div 
                      className="bg-rose-500 h-full transition-all duration-500" 
                      style={{ width: `${total > 0 ? (q.dead_lettered / total) * 100 : 0}%` }}
                      title={`Dead Lettered: ${q.dead_lettered}`}
                    ></div>
                  </div>
                </div>

                {/* Counts breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center mt-2">
                  <div className="bg-neutral-900/40 p-2 rounded border border-neutral-900/60">
                    <div className="text-[9px] font-mono text-muted uppercase">Queued</div>
                    <div className="text-base font-bold text-blue-400 mt-1">{q.queued}</div>
                  </div>
                  <div className="bg-neutral-900/40 p-2 rounded border border-neutral-900/60">
                    <div className="text-[9px] font-mono text-muted uppercase">Processing</div>
                    <div className="text-base font-bold text-amber-400 mt-1">{q.processing}</div>
                  </div>
                  <div className="bg-neutral-900/40 p-2 rounded border border-neutral-900/60">
                    <div className="text-[9px] font-mono text-muted uppercase">Completed</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">{q.completed}</div>
                  </div>
                  <div className="bg-neutral-900/40 p-2 rounded border border-neutral-900/60">
                    <div className="text-[9px] font-mono text-muted uppercase">DLQ</div>
                    <div className="text-base font-bold text-rose-400 mt-1">{q.dead_lettered}</div>
                  </div>
                  <div className="bg-neutral-900/40 p-2 rounded border border-neutral-900/60">
                    <div className="text-[9px] font-mono text-muted uppercase">Failed</div>
                    <div className="text-base font-bold text-orange-400 mt-1">{q.failed}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
