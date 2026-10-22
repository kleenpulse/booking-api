import type * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  tone = "calm",
  className,
}: {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "calm" | "critical";
  className?: string;
}) {
  return (
    <div
      role={tone === "critical" ? "alert" : undefined}
      className={cn("flex flex-col items-center justify-center px-8 py-14 text-center", className)}
    >
      <span aria-hidden className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-full ring-1 ring-border dark:ring-glass-border" />
        <span className="absolute inset-4 rounded-full ring-1 ring-border dark:ring-glass-border" />
        <span className="grid size-8 place-items-center rounded-full bg-card-nested ring-1 ring-border dark:ring-glass-border">
          <span className={cn("size-2 rounded-full", tone === "critical" ? "bg-critical" : "bg-signal")} />
        </span>
      </span>
      <p className="mt-6 font-display text-xl leading-tight tracking-[-0.01em] text-foreground">{title}</p>
      {body && <div className="mt-2 max-w-xs text-[13px] leading-relaxed text-pretty text-ink-2">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
