"use client";

import * as React from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { bookSlot, type BookState } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { ALL, ProviderTabs } from "@/components/provider-tabs";
import type { SlotView } from "@/lib/format";
import { cn } from "@/lib/utils";

type Day = { key: string; label: string; slots: SlotView[] };

function groupByDay(slots: SlotView[]): Day[] {
  const days: Day[] = [];
  for (const slot of slots) {
    const last = days[days.length - 1];
    if (last?.key === slot.dayKey) last.slots.push(slot);
    else days.push({ key: slot.dayKey, label: slot.day, slots: [slot] });
  }
  return days;
}

/** Slots arrive sorted by start time and already formatted in the clinic's zone. */
export function SlotBoard({ slots, formKey }: { slots: SlotView[]; formKey: string }) {
  const [doctor, setDoctor] = useQueryState("doctor", parseAsString.withDefault(ALL));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const providers = React.useMemo(() => [...new Set(slots.map((s) => s.provider))].sort(), [slots]);
  // A shared link may name a doctor with no open slots left: show everyone instead.
  const provider = providers.includes(doctor) ? doctor : ALL;
  const days = groupByDay(provider === ALL ? slots : slots.filter((s) => s.provider === provider));
  const selected = slots.find((s) => s.id === selectedId) ?? null;
  const open = slots.filter((s) => s.available).length;

  function select(slot: SlotView) {
    setSelectedId(slot.id);
    // Below lg the panel sits under the list: bring the form into view.
    if (!window.matchMedia("(min-width: 64rem)").matches) {
      panelRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  if (slots.length === 0) {
    return (
      <div className="bento entrance mt-10 p-5">
        <EmptyState
          title="No open times right now"
          body="New appointments show up here as soon as the clinic adds them."
        />
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        <div className="sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3">
          <ProviderTabs providers={providers} value={provider} onValueChange={(v) => void setDoctor(v || null)} />
          <p className="readout tabular rounded-pill bg-background/70 px-2.5 py-1 backdrop-blur-md">
            {open} open {open === 1 ? "time" : "times"}
          </p>
        </div>

        {days.map((day, i) => (
          <section
            key={`${provider}:${day.key}`}
            aria-label={day.label}
            className="bento entrance p-5"
            style={{ ["--i" as string]: i }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[17px] leading-tight tracking-[-0.01em]">{day.label}</h2>
              <span className="readout tabular">{day.slots.filter((s) => s.available).length} open</span>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {day.slots.map((slot) => (
                <li key={slot.id}>
                  <SlotButton slot={slot} selected={slot.id === selectedId} onSelect={() => select(slot)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div ref={panelRef} className="scroll-mt-3 lg:sticky lg:top-3">
        <BookingPanel slot={selected} formKey={formKey} />
      </div>
    </div>
  );
}

function SlotButton({ slot, selected, onSelect }: { slot: SlotView; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      disabled={!slot.available}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-[20px] px-3.5 py-3 text-left outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-signal-soft ring-1 ring-signal/30 dark:ring-signal/45"
          : slot.available
            ? "bg-card-nested hover:shadow-lift dark:ring-1 dark:ring-glass-border"
            : "cursor-not-allowed border border-dashed border-border dark:border-glass-border",
      )}
    >
      <span
        className={cn(
          "font-display text-[19px] leading-none tracking-[-0.01em] tabular",
          !slot.available && "text-ink-3 line-through decoration-1",
        )}
      >
        {slot.time}
      </span>
      <span className={cn("w-full truncate text-[12.5px]", slot.available ? "text-ink-2" : "text-ink-3")}>
        {slot.available ? slot.provider : `Booked · ${slot.provider}`}
      </span>
    </button>
  );
}

function BookingPanel({ slot, formKey }: { slot: SlotView | null; formKey: string }) {
  const [state, action, pending] = React.useActionState<BookState, FormData>(bookSlot, {
    error: null,
    field: null,
    key: formKey,
    slotId: null,
    name: "",
    email: "",
  });
  // An answer belongs to the slot it was about; picking another slot clears it.
  const error = slot && state.slotId === slot.id ? state.error : null;
  const field = error ? state.field : null;
  // After a refresh the picked slot may turn out to be taken.
  const taken = !!slot && !slot.available;

  return (
    <section aria-label="Your visit" className="bento p-5">
      <p className="readout">Your visit</p>
      {!slot ? (
        <EmptyState
          className="py-10"
          title="Pick a time"
          body="Choose any open time to start. It is yours as soon as you confirm."
        />
      ) : (
        <>
          <div className="mt-3 rounded-[22px] bg-card-nested p-4 dark:ring-1 dark:ring-glass-border">
            <p className="readout">{slot.longDay}</p>
            <p className="mt-2 font-display text-kpi tabular">
              {slot.time}
              <span className="text-[17px] tracking-normal text-ink-2"> – {slot.endTime}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-[13.5px]">
              <span aria-hidden className="size-1.5 rounded-full bg-signal" />
              {slot.provider}
            </p>
          </div>

          <form action={action} noValidate className="mt-4 space-y-3">
            <input type="hidden" name="slot_id" value={slot.id} />
            <input type="hidden" name="idempotency_key" value={state.key} />
            <Field
              label="Full name"
              name="name"
              autoComplete="name"
              defaultValue={state.name}
              invalid={field === "name"}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              invalid={field === "email"}
            />
            {error && (
              <p
                id="booking-error"
                role="alert"
                className="rounded-[18px] bg-critical/10 px-3.5 py-3 text-[13px] leading-snug text-critical"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending || taken}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-pill bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              {taken ? (
                "This time is taken"
              ) : pending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" /> Booking…
                </>
              ) : (
                <>
                  Confirm booking <ArrowRight className="size-4" />
                </>
              )}
            </button>
            <p className="text-[12px] leading-relaxed text-ink-3">
              Your email is only used to look up your bookings.
            </p>
          </form>
        </>
      )}
    </section>
  );
}

function Field({
  label,
  invalid,
  ...props
}: { label: string; invalid: boolean } & React.ComponentProps<"input">) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="readout block">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "booking-error" : undefined}
        className="h-10 w-full min-w-0 rounded-[14px] border border-input bg-sheet px-3 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-card-nested dark:hover:border-foreground/25"
        {...props}
      />
    </div>
  );
}
