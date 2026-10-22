"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { TAB_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Book" },
  { href: "/my-bookings", label: "My bookings" },
] as const;

export function ActiveNav() {
  const pathname = usePathname();
  return <NavPills current={pathname === "/" || pathname.startsWith("/booking/") ? "/" : pathname} />;
}

export function NavPills({ current }: { current: string | null }) {
  const layoutId = useId();
  return (
    <div className="flex items-center rounded-pill bg-sheet p-1 ring-1 ring-border dark:bg-background/40 dark:ring-glass-border">
      {NAV.map((item) => {
        const active = current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate inline-flex h-8 items-center rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-inverse-foreground dark:text-signal" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                layoutDependency={current}
                transition={TAB_SPRING}
                aria-hidden
                style={{ borderRadius: 9999 }}
                className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft"
              />
            )}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
