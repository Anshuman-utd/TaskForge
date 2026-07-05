"use client";
import React, { useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface DispatchJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DispatchJobModal({ isOpen, onClose, onSuccess }: DispatchJobModalProps) {
  const [jobType, setJobType] = useState<"demo_sleep" | "demo_fail">("demo_sleep");
  const [queueName, setQueueName] = useState("default");
  const [payload, setPayload] = useState('{\n  "duration": 3\n}');
  const [maxRetries, setMaxRetries] = useState(3);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Set default payload based on job type selection
  useEffect(() => {
    if (jobType === "demo_sleep") {
      setPayload('{\n  "duration": 3\n}');
    } else {
      setPayload('{\n}');
    }
    setJsonError(null);
  }, [jobType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    setSubmitError(null);

    // Validate JSON
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(payload);
    } catch (err: any) {
      setJsonError("Invalid JSON: " + err.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createJob(jobType, queueName, parsedPayload, maxRetries);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to dispatch job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!isSubmitting && !showSuccess) onClose();
        }}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md p-6 bg-card border border-border rounded-lg shadow-2xl z-10 select-none">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>Dispatch Control Plane Job</span>
          </h2>
          {!isSubmitting && !showSuccess && (
            <button 
              onClick={onClose}
              className="text-muted hover:text-foreground text-xs font-semibold cursor-pointer"
            >
              ESC
            </button>
          )}
        </div>

        {showSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-xs font-mono font-semibold text-emerald-400">Job Dispatched Successfully</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Job Type */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wide">Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as any)}
                className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-neutral-500"
                disabled={isSubmitting}
              >
                <option value="demo_sleep">demo_sleep (Success flow)</option>
                <option value="demo_fail">demo_fail (Retry & DLQ flow)</option>
              </select>
            </div>

            {/* Queue Name */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wide">Target Queue</label>
              <input
                type="text"
                value={queueName}
                onChange={(e) => setQueueName(e.target.value)}
                className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-neutral-500"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Max Retries */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wide">Max Retries</label>
              <input
                type="number"
                min="0"
                max="10"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                className="bg-neutral-900 border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-neutral-500"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Payload JSON */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-mono text-muted uppercase tracking-wide">Payload (JSON)</label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={5}
                className="bg-neutral-950 border border-border rounded p-3 font-mono text-xs text-neutral-300 focus:outline-none focus:border-neutral-500 resize-none"
                disabled={isSubmitting}
                required
              />
              {jsonError && (
                <span className="text-[10px] text-rose-400 font-mono mt-1">{jsonError}</span>
              )}
            </div>

            {submitError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/60 rounded text-[10px] font-mono text-rose-400">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="cursor-pointer"
              >
                Dispatch Run
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
