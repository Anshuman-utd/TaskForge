import React from "react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let styles = "text-muted bg-neutral-500/10 border-neutral-500/20";
  let label = status;

  switch (status.toLowerCase()) {
    case "queued":
      styles = "text-blue-400 bg-blue-500/10 border border-blue-500/20";
      label = "Queued";
      break;
    case "processing":
      styles = "text-amber-400 bg-amber-500/10 border border-amber-500/20";
      label = "Processing";
      break;
    case "completed":
      styles = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
      label = "Completed";
      break;
    case "failed":
      styles = "text-orange-400 bg-orange-500/10 border border-orange-500/20";
      label = "Failed";
      break;
    case "dead_lettered":
    case "dead-lettered":
      styles = "text-rose-400 bg-rose-500/10 border border-rose-500/20";
      label = "Dead Lettered";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium tracking-wide ${styles}`}>
      {label}
    </span>
  );
}
