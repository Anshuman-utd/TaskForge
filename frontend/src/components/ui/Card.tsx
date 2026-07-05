import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export function Card({ title, subtitle, headerAction, children, className = "", ...props }: CardProps) {
  return (
    <div className={`bg-card border border-border rounded-lg p-5 shadow-sm ${className}`} {...props}>
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
