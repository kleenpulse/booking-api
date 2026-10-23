"use client";

import * as React from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { bookSlot, type BookState } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { ALL, ProviderTabs } from "@/components/provider-tabs";
import type { SlotView } from "@/lib/format";
import { TAB_SPRING } from "@/lib/motion";
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

const WIDE = "(min-width: 64rem)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Slots arrive sorted by start time and already formatted in the clinic's zone. */
export function SlotBoard({ slots, formKey }: { slots: SlotView[]; formKey: string }) {
  const [doctor, setDoctor] = useQueryState("doctor", parseAsString.withDefault(ALL));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const fabRef = React.useRef<HTMLButtonElement>(null);
  // Matches the lg breakpoint: the panel is a sidebar there and a bottom sheet below it.
  const wide = React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

  const providers = React.useMemo(() => [...new Set(slots.map((s) => s.provider))].sort(), [slots]);
  // A shared link may name a doctor with no open slots left: show everyone instead.
  const provider = providers.includes(doctor) ? doctor : ALL;
  const days = groupByDay(provider === ALL ? slots : slots.filter((s) => s.provider === provider));
  const selected = slots.find((s) => s.id === selectedId) ?? null;
  const open = slots.filter((s) => s.available).length;

  const closeSheet = React.useCallback(() => {
    setSheetOpen(false);
    fabRef.current?.focus();
  }, []);

  // The sheet only exists below lg.
  const sheetShown = sheetOpen && !wide;

  React.useEffect(() => {
    if (!sheetShown) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetShown, closeSheet]);

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
    <div className={cn("mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start", selected && "max-lg:pb-20")}>
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
                  <SlotButton slot={slot} selected={slot.id === selectedId} onSelect={() => setSelectedId(slot.id)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* One panel instance for both layouts, so the form keeps its state when the sheet closes. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role={wide ? undefined : "dialog"}
        aria-modal={wide ? undefined : true}
        aria-label={wide ? undefined : "Your visit"}
        inert={!wide && !sheetShown}
        className={cn(
          "outline-none lg:sticky lg:top-3",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[88dvh] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-t-[var(--radius-card)] max-lg:bg-background max-lg:pb-[env(safe-area-inset-bottom)] max-lg:motion-reduce:transition-none",
          sheetShown
            ? "max-lg:translate-y-0 max-lg:[transition:transform_350ms_var(--ease-out-quint)]"
            : "max-lg:invisible max-lg:translate-y-full max-lg:[transition:transform_250ms_ease-in,visibility_0s_250ms]",
        )}
      >
        <BookingPanel slot={selected} formKey={formKey} onClose={closeSheet} />
      </div>

      <div
        aria-hidden
        onClick={closeSheet}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden",
          sheetShown ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <AnimatePresence>
        {selected && (
          <motion.button
            ref={fabRef}
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetShown}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={TAB_SPRING}
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex h-14 items-center gap-3 rounded-pill bg-primary pr-4 pl-5 text-primary-foreground shadow-lift outline-none transition-colors hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] lg:hidden"
          >
            <span className="flex flex-col items-start text-left">
              <span className="font-display text-[19px] leading-none tracking-[-0.01em] tabular">{selected.time}</span>
              <span className="mt-1 max-w-[9rem] truncate text-[11.5px] leading-none opacity-75">{selected.provider}</span>
            </span>
            <span aria-hidden className="h-7 w-px bg-current opacity-20" />
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              Book <ArrowRight className="size-4" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
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

function BookingPanel({ slot, formKey, onClose }: { slot: SlotView | null; formKey: string; onClose: () => void }) {
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
      <div className="flex items-center justify-between gap-3">
        <p className="readout">Your visit</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-my-2 -mr-2 grid size-9 place-items-center rounded-full text-ink-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>
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
