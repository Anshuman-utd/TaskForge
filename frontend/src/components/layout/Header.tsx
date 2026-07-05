"use client";
import React, { useEffect, useState } from "react";
import { wsClient, ConnectionState } from "@/lib/websocket/client";
import { Button } from "../ui/Button";
import { RefreshIcon, PlusIcon } from "../icons";
import { DispatchJobModal } from "../dashboard/DispatchJobModal";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const [wsState, setWsState] = useState<ConnectionState>("DISCONNECTED");
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  useEffect(() => {
    // Subscribe to WebSocket state updates
    const unsubscribe = wsClient.subscribeState((state) => {
      setWsState(state);
    });
    // Start WebSocket connection on client load
    wsClient.connect();
    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualReconnect = () => {
    wsClient.connect();
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-8 shrink-0 select-none">
      {/* Page Title */}
      <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>

      {/* Header Actions */}
      <div className="flex items-center space-x-4">
        {/* WS Connection Status indicator */}
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            {wsState === "CONNECTED" && (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            )}
            {wsState === "RECONNECTING" && (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </>
            )}
            {wsState === "DISCONNECTED" && (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            )}
          </span>
          <span className="text-xs font-mono font-medium text-neutral-300">
            {wsState === "CONNECTED" && "Websocket Active"}
            {wsState === "RECONNECTING" && "Reconnecting..."}
            {wsState === "DISCONNECTED" && "Websocket Down"}
          </span>
          {wsState !== "CONNECTED" && (
            <button 
              onClick={handleManualReconnect}
              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Manual Reconnect"
            >
              <RefreshIcon size={12} />
            </button>
          )}
        </div>

        {/* Separator */}
        <span className="h-4 w-px bg-border"></span>

        {/* Dispatch Action */}
        <div>
          <Button 
            size="sm" 
            variant="primary" 
            onClick={() => setIsDispatchModalOpen(true)}
            className="text-[11px] font-semibold py-1 px-2.5 cursor-pointer"
          >
            <PlusIcon size={12} className="mr-1.5 text-neutral-900" />
            Dispatch Job
          </Button>
          
          <DispatchJobModal 
            isOpen={isDispatchModalOpen} 
            onClose={() => setIsDispatchModalOpen(false)}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent("job-dispatched"));
            }}
          />
        </div>
      </div>
    </header>
  );
}
