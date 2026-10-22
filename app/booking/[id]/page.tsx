import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Check, X } from "lucide-react";
import { CancelButton } from "@/components/cancel-button";
import { StatusChip } from "@/components/status-chip";
import { CLINIC_TIME_ZONE_NAME } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bookingView } from "@/lib/views";

export const metadata: Metadata = {
  title: "Your booking",
  // Booking pages are personal: keep them out of search results.
  robots: { index: false, follow: false },
};

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
      <Suspense fallback={<div className="bento h-96 animate-pulse" />}>
        <Confirmation params={params} />
      </Suspense>
    </main>
  );
}

async function Confirmation({ params }: Pick<PageProps<"/booking/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const booking = await bookingView(id);
  if (!booking) notFound();

  const confirmed = booking.status === "confirmed";
  const { slot } = booking;

  return (
    <>
      <section className="entrance flex flex-col items-start gap-5">
        <span
          aria-hidden
          className={cn(
            "grid size-14 animate-bloom place-items-center rounded-full",
            confirmed ? "bg-inverse text-inverse-foreground dark:bg-signal-soft dark:text-signal dark:shadow-glow" : "bg-card-nested text-ink-2 ring-1 ring-border dark:ring-glass-border",
          )}
        >
          {confirmed ? <Check className="size-6" strokeWidth={2.4} /> : <X className="size-6" />}
        </span>
        <div>
          <p className="readout">{confirmed ? "Booking confirmed" : "Booking cancelled"}</p>
          <h1 className="mt-3 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.98] tracking-[-0.035em] text-balance">
            {confirmed ? (
              <>
                You are booked<span className="text-signal">.</span>
              </>
            ) : (
              "This visit was cancelled."
            )}
          </h1>
          <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-2">
            {confirmed
              ? `See you then, ${booking.name}. Keep this page: it is your confirmation.`
              : "The time is free again for someone else. You can book a new one any time."}
          </p>
        </div>
      </section>

      <section aria-label="Booking details" className="bento entrance mt-8 p-5" style={{ ["--i" as string]: 1 }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[17px] leading-tight tracking-[-0.01em]">Your visit</h2>
          <StatusChip status={booking.status} />
        </div>

        {slot && (
          <div className="mt-4 rounded-[22px] bg-card-nested p-4 dark:ring-1 dark:ring-glass-border">
            <p className="readout">{slot.longDay}</p>
            <p className={cn("mt-2 font-display text-kpi tabular", !confirmed && "text-ink-3 line-through decoration-2")}>
              {slot.time}
              <span className="text-[17px] tracking-normal text-ink-2"> – {slot.endTime}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-[13.5px]">
              <span aria-hidden className={cn("size-1.5 rounded-full", confirmed ? "bg-signal" : "bg-ink-3")} />
              {slot.provider}
            </p>
          </div>
        )}

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Name">{booking.name}</Detail>
          <Detail label="Email">{booking.email}</Detail>
          <Detail label="Booked">
            <span className="tabular">{booking.booked}</span>
          </Detail>
          <Detail label="Time zone">{CLINIC_TIME_ZONE_NAME}</Detail>
          <Detail label="Booking ID" className="sm:col-span-2">
            <span className="font-mono text-[12.5px] break-all">{booking.id}</span>
          </Detail>
        </dl>
      </section>

      <div className="entrance mt-6 flex flex-wrap items-center justify-between gap-3" style={{ ["--i" as string]: 2 }}>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-pill bg-inverse px-5 text-sm font-medium text-inverse-foreground outline-none transition-[background-color,transform] hover:bg-inverse/88 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <ArrowLeft className="size-4" /> {confirmed ? "Book another time" : "Pick a new time"}
          </Link>
          <Link
            href={`/my-bookings?email=${encodeURIComponent(booking.email)}`}
            className="inline-flex h-10 items-center rounded-pill px-4 text-sm font-medium text-ink-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            All my bookings
          </Link>
        </div>
        {confirmed && <CancelButton id={booking.id} />}
      </div>
    </>
  );
}

function Detail({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="readout">{label}</dt>
      <dd className="mt-1 text-[14px] break-words">{children}</dd>
    </div>
  );
}
