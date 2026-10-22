"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { cancelSlot } from "@/app/actions";

/** Two steps, so a stray tap can't give the slot away. */
export function CancelButton({ id }: { id: string }) {
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 items-center gap-2 rounded-pill px-5 text-sm font-medium text-ink-2 ring-1 ring-border outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring dark:ring-glass-border"
      >
        <X className="size-4" /> Cancel booking
      </button>
    );
  }

  return (
    <form action={cancelSlot.bind(null, id)} className="flex flex-wrap items-center gap-2">
      <p className="mr-1 text-[13px] text-ink-2">Free up this time?</p>
      <ConfirmCancel />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex h-10 items-center rounded-pill px-4 text-sm font-medium text-ink-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Keep it
      </button>
    </form>
  );
}

function ConfirmCancel() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      autoFocus
      className="inline-flex h-10 items-center gap-2 rounded-pill bg-destructive/10 px-5 text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:opacity-70"
    >
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      Yes, cancel it
    </button>
  );
}
