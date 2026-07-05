"use client";
import React, { useState } from "react";
import { formatJson } from "@/lib/formatters";

interface CodeBlockProps {
  data: any;
  title?: string;
  defaultExpanded?: boolean;
}

export function CodeBlock({ data, title, defaultExpanded = true }: CodeBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const formatted = formatJson(data);

  return (
    <div className="bg-neutral-950 border border-border rounded-lg overflow-hidden font-mono text-xs text-neutral-300">
      <div 
        onClick={() => setExpanded(!expanded)} 
        className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-border cursor-pointer select-none"
      >
        <span className="font-semibold text-neutral-400">{title || "JSON Data"}</span>
        <span className="text-neutral-500 hover:text-neutral-300 text-[10px]">
          {expanded ? "COLLAPSE" : "EXPAND"}
        </span>
      </div>
      {expanded && (
        <pre className="p-4 overflow-x-auto max-h-[350px] whitespace-pre-wrap break-all leading-relaxed">
          <code>{formatted}</code>
        </pre>
      )}
    </div>
  );
}
