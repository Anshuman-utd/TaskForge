import React from "react";

interface LoaderProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export function Loader({ text = "Loading operator console...", size = "md" }: LoaderProps) {
  let sizeStyles = "h-8 w-8";
  if (size === "sm") sizeStyles = "h-4 w-4";
  if (size === "lg") sizeStyles = "h-12 w-12";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-4">
      <svg className={`animate-spin text-zinc-400 ${sizeStyles}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text && <p className="text-xs font-mono text-muted tracking-tight animate-pulse">{text}</p>}
    </div>
  );
}
