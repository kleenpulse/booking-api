"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { loadBookings } from "@/app/actions";
import { StatusChip } from "@/components/status-chip";
import type { BookingView } from "@/lib/format";
import type { BookingPageView } from "@/lib/views";
import { cn } from "@/lib/utils";

export function BookingList({ email, initial }: { email: string; initial: BookingPageView }) {
  const [bookings, setBookings] = React.useState(initial.bookings);
  const [cursor, setCursor] = React.useState(initial.next_cursor);
  const [failed, setFailed] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const page = await loadBookings(email, cursor);
      if (!page) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setBookings((prev) => [...prev, ...page.bookings]);
      setCursor(page.next_cursor);
    });
  }

  return (
    <div>
      <p className="readout tabular">
        {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
        {cursor ? " so far" : ""} for <span className="normal-case text-foreground/80">{email}</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {bookings.map((booking, i) => (
          <BookingRow key={booking.id} booking={booking} i={i} />
        ))}
      </ul>
      <div className="mt-5 flex flex-col items-center gap-2">
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-pill bg-sheet px-5 text-sm font-medium ring-1 ring-border outline-none transition-[background-color,transform] hover:bg-card focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:opacity-70 dark:bg-card-nested dark:ring-glass-border dark:hover:bg-accent"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? "Loading…" : "Load more"}
          </button>
        ) : (
          bookings.length > initial.bookings.length && <p className="readout">That is all of them</p>
        )}
        {failed && (
          <p role="alert" className="text-[13px] text-critical">
            Could not load more bookings. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking, i }: { booking: BookingView; i: number }) {
  const { slot } = booking;
  const cancelled = booking.status === "cancelled";
  return (
    <li
      className="entrance relative flex items-center gap-4 rounded-[20px] bg-card px-4 py-3.5 transition-[background-color,box-shadow] duration-200 hover:bg-card-nested hover:shadow-lift dark:ring-1 dark:ring-glass-border"
      // Restart the stagger for each loaded page.
      style={{ ["--i" as string]: i % 5 }}
    >
      <div className="w-[4.5rem] shrink-0">
        <p className={cn("font-display text-[19px] leading-none tracking-[-0.01em] tabular", cancelled && "text-ink-3 line-through decoration-1")}>
          {slot?.time ?? "--:--"}
        </p>
        <p className="mt-1.5 font-mono text-[11px] tracking-wide text-ink-2 tabular">{slot?.day ?? "Unknown"}</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/booking/${booking.id}`}
          className={cn(
            "block truncate text-[14px] leading-5 font-medium outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-2 focus-visible:after:ring-ring",
            cancelled ? "text-foreground/70" : "text-foreground",
          )}
        >
          {slot?.provider ?? "Removed slot"}
        </Link>
        <p className="truncate text-[12.5px] leading-[18px] text-ink-2">
          Booked <span className="tabular">{booking.booked}</span>
        </p>
      </div>
      <StatusChip status={booking.status} />
    </li>
  );
}
