"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="bg-neutral-950 border border-border rounded-lg overflow-hidden h-[540px] flex flex-col font-mono text-xs shadow-2xl">
      <div className="bg-neutral-900 px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="font-semibold text-neutral-300 tracking-tight">Live Operator Log Stream</span>
        </div>
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">STDOUT</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-2 select-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="italic text-[11px]">Awaiting orchestration pipeline triggers...</span>
          </div>
        ) : (
          events.map((ev, idx) => {
            let colorClass = "text-neutral-400";
            let borderAccent = "border-l-neutral-700";
            
            if (ev.event_type.endsWith("created")) {
              colorClass = "text-blue-400";
              borderAccent = "border-l-blue-500/50";
            } else if (ev.event_type.endsWith("processing")) {
              colorClass = "text-amber-400";
              borderAccent = "border-l-amber-500/50";
            } else if (ev.event_type.endsWith("completed")) {
              colorClass = "text-emerald-400";
              borderAccent = "border-l-emerald-500/50";
            } else if (ev.event_type.endsWith("failed") || ev.event_type.endsWith("dead_lettered")) {
              colorClass = "text-rose-400";
              borderAccent = "border-l-rose-500/50";
            }

            return (
              <div 
                key={idx} 
                className={`flex flex-col space-y-1 pl-3 border-l-2 ${borderAccent} pb-2 border-b border-neutral-900/60 last:border-b-0 last:pb-0`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold tracking-tight text-[11px] ${colorClass}`}>{ev.event_type}</span>
                  <span className="text-[9px] text-neutral-600">{formatTimestamp(ev.timestamp)}</span>
                </div>
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  Job{" "}
                  <Link 
                    href={`/jobs/${ev.job_id}`}
                    className="text-blue-400 hover:underline font-bold"
                  >
                    {ev.job_id.substring(0, 8)}
                  </Link>{" "}
                  on queue <span className="text-zinc-300 font-semibold">{ev.queue_name}</span> transitioned status to{" "}
                  <span className="text-zinc-200 font-bold">{ev.status}</span> (attempt {ev.attempt_count})
                </div>
                {ev.data && Object.keys(ev.data).length > 0 && (
                  <pre className="text-[10px] bg-neutral-900/80 p-2 rounded border border-neutral-800/40 text-neutral-500 overflow-x-auto whitespace-pre-wrap break-all max-h-24 leading-normal">
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
