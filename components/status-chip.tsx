import type { BookingStatus } from "@/lib/bookings";
import { cn } from "@/lib/utils";

const TONE: Record<BookingStatus, { pill: string; dot: string; label: string }> = {
  confirmed: { pill: "bg-ok/12 text-ok", dot: "bg-ok", label: "Confirmed" },
  cancelled: { pill: "bg-foreground/8 text-ink-2", dot: "bg-ink-3", label: "Cancelled" },
};

export function StatusChip({ status, className }: { status: BookingStatus; className?: string }) {
  const tone = TONE[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-pill px-2.5 font-mono text-[10.5px] tracking-wide uppercase",
        tone.pill,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}
