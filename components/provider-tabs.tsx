"use client";

import * as React from "react";
import { motion } from "motion/react";
import { TAB_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const ALL = "";

export function ProviderTabs({
  providers,
  value,
  onValueChange,
}: {
  providers: string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const layoutId = React.useId();
  const items = [{ value: ALL, label: "All doctors" }, ...providers.map((p) => ({ value: p, label: p }))];
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    refs.current[next]?.focus();
    onValueChange(items[next].value);
  }

  return (
    <motion.div
      layoutScroll
      role="tablist"
      aria-label="Filter by doctor"
      className="flex max-w-full items-center overflow-x-auto rounded-pill bg-sheet/85 p-1 ring-1 ring-border backdrop-blur-xl [scrollbar-width:none] dark:bg-background/60 dark:ring-glass-border"
    >
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative isolate inline-flex h-8 shrink-0 items-center rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-inverse-foreground dark:text-signal" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                layoutDependency={value}
                transition={TAB_SPRING}
                aria-hidden
                style={{ borderRadius: 9999 }}
                className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft"
              />
            )}
            {item.label}
          </button>
        );
      })}
    </motion.div>
  );
}
