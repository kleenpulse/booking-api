"use client";

import * as React from "react";

// Module memory: survives client navigation, cleared by a full page load.
let lastLookup: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLastLookup() {
  return React.useSyncExternalStore(
    subscribe,
    () => lastLookup,
    () => null,
  );
}

/** Renders nothing; records the email the bookings page last showed. */
export function RememberLookup({ email }: { email: string }) {
  React.useEffect(() => {
    lastLookup = email;
    listeners.forEach((listener) => listener());
  }, [email]);
  return null;
}
