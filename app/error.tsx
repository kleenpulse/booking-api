"use client";

import { EmptyState } from "@/components/empty-state";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
      <div className="bento entrance p-5">
        <EmptyState
          tone="critical"
          title="Something went wrong"
          body="We could not load this page. Your bookings are safe. Try again in a moment."
          action={
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-10 items-center rounded-pill bg-inverse px-5 text-sm font-medium text-inverse-foreground outline-none transition-[background-color,transform] hover:bg-inverse/88 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              Try again
            </button>
          }
        />
      </div>
    </main>
  );
}
