"use client";
import React, { useEffect, useState } from "react";
import { wsClient } from "@/lib/websocket/client";
import { RealtimeEvent } from "@/lib/types";
import { formatTimestamp } from "@/lib/formatters";

export function LiveEventsFeed() {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    const handleEvent = (event: RealtimeEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50)); // Hold last 50 events
    };

    // Open connection & register callbacks
    wsClient.connect();
    const unsubscribe = wsClient.subscribe(handleEvent);

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="bg-neutral-950 border border-border rounded-lg overflow-hidden h-[400px] flex flex-col font-mono text-xs shadow-inner">
      <div className="bg-neutral-900 px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="font-semibold text-neutral-400">Live Operator Audit Log</span>
        <span className="flex h-1.5 w-1.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-500 italic">
            Waiting for live task transitions...
          </div>
        ) : (
          events.map((ev, idx) => {
            let colorClass = "text-neutral-400";
            if (ev.event_type.endsWith("created")) colorClass = "text-blue-400";
            if (ev.event_type.endsWith("processing")) colorClass = "text-amber-400";
            if (ev.event_type.endsWith("completed")) colorClass = "text-emerald-400";
            if (ev.event_type.endsWith("failed") || ev.event_type.endsWith("dead_lettered")) colorClass = "text-rose-400";

            return (
              <div key={idx} className="flex flex-col space-y-0.5 border-b border-neutral-900 pb-2 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${colorClass}`}>{ev.event_type}</span>
                  <span className="text-[10px] text-neutral-500">{formatTimestamp(ev.timestamp)}</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Job <span className="text-neutral-200">{ev.job_id.substring(0, 8)}</span> ({ev.queue_name}) status set to <span className="text-neutral-300 font-semibold">{ev.status}</span> (attempt {ev.attempt_count})
                </div>
                {ev.data && Object.keys(ev.data).length > 0 && (
                  <pre className="text-[10px] bg-neutral-900/50 p-1.5 rounded mt-1 border border-neutral-900/80 text-neutral-500 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(ev.data)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
