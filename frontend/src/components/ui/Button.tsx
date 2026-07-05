import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({ variant = "secondary", size = "md", isLoading, children, className = "", ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  let variantStyles = "";
  let sizeStyles = "";

  switch (variant) {
    case "primary":
      variantStyles = "bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-200";
      break;
    case "secondary":
      variantStyles = "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-750";
      break;
    case "danger":
      variantStyles = "bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-900";
      break;
  }

  switch (size) {
    case "sm":
      sizeStyles = "px-2.5 py-1 text-xs";
      break;
    case "md":
      sizeStyles = "px-3.5 py-2 text-sm";
      break;
    case "lg":
      sizeStyles = "px-5 py-2.5 text-base";
      break;
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`} disabled={isLoading} {...props}>
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
