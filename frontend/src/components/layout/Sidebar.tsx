"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, JobsIcon, QueuesIcon, AlertIcon } from "../icons";

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
    { href: "/jobs", label: "Jobs", icon: JobsIcon },
    { href: "/queues", label: "Queues", icon: QueuesIcon },
    { href: "/dead-letter", label: "Dead Letter", icon: AlertIcon },
  ];

  return (
    <aside className="w-60 border-r border-border bg-neutral-950 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-14 border-b border-border flex items-center px-6">
        <Link href="/dashboard" className="flex items-center space-x-2.5">
          <div className="h-5 w-5 rounded bg-zinc-100 flex items-center justify-center">
            <span className="text-[10px] font-black text-zinc-950">TF</span>
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">TaskForge</span>
          <span className="text-[9px] font-mono font-medium text-muted px-1.5 py-0.5 rounded border border-border bg-neutral-900 leading-none">v1.0</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          // Exact match for dashboard, prefix match for others (e.g. /jobs/[id] matches /jobs)
          const isActive = link.href === "/dashboard" 
            ? pathname === "/dashboard" 
            : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded text-xs font-semibold tracking-wide transition-colors ${
                isActive
                  ? "bg-neutral-900 text-foreground"
                  : "text-muted hover:bg-neutral-900/60 hover:text-foreground"
              }`}
            >
              <Icon size={14} className={isActive ? "text-foreground" : "text-muted"} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      
      {/* System status indicator at bottom of sidebar */}
      <div className="p-4 border-t border-border flex flex-col space-y-1 bg-neutral-950">
        <span className="text-[9px] font-mono text-muted uppercase tracking-wider">Infrastructure</span>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-neutral-300 font-medium">Postgres & Redis OK</span>
        </div>
      </div>
    </aside>
  );
}
