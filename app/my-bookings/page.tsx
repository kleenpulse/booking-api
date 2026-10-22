import type { Metadata } from "next";
import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { BookingList } from "@/components/booking-list";
import { EmptyState } from "@/components/empty-state";
import { BookingListSkeleton } from "@/components/skeletons";
import { bookingPage } from "@/lib/views";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Find every booking made with your email address.",
  robots: { index: false, follow: true },
};

export default function MyBookingsPage({ searchParams }: PageProps<"/my-bookings">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
      <section className="entrance">
        <p className="readout">Look up</p>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] leading-[0.96] tracking-[-0.04em]">
          My bookings<span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-2">
          Enter the email you booked with to see every visit, oldest first.
        </p>
      </section>
      <Suspense
        fallback={
          <>
            <Lookup email="" />
            <div className="mt-8">
              <BookingListSkeleton />
            </div>
          </>
        }
      >
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Lookup({ email }: { email: string }) {
  return (
    <Form action="/my-bookings" className="entrance mt-8 flex flex-col gap-2 sm:flex-row" style={{ ["--i" as string]: 1 }}>
      <label className="relative flex-1">
        <span className="sr-only">Email</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
          placeholder="you@example.com"
          className="h-11 w-full min-w-0 rounded-pill border border-input bg-sheet pr-4 pl-11 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 md:text-sm dark:bg-card-nested dark:hover:border-foreground/25"
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-pill bg-inverse px-6 text-sm font-medium text-inverse-foreground outline-none transition-[background-color,transform] hover:bg-inverse/88 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      >
        Find bookings
      </button>
    </Form>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/my-bookings">, "searchParams">) {
  await connection();
  const raw = (await searchParams).email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!email) {
    return (
      <>
        <Lookup email="" />
        <div className="bento entrance mt-8 p-5" style={{ ["--i" as string]: 2 }}>
          <EmptyState
            title="Your visits show up here"
            body="Search with the email you used when booking. No account or password needed."
            action={
              <Link
                href="/"
                className="rounded-sm text-[13px] font-medium text-ink-2 underline decoration-border underline-offset-4 outline-none transition-colors hover:text-foreground hover:decoration-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Not booked yet? See open times
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const page = await bookingPage(email, null);
  return (
    <>
      <Lookup email={email} />
      <div className="mt-8">
        {page.bookings.length === 0 ? (
          <div className="bento entrance p-5">
            <EmptyState
              title="No bookings yet"
              body={
                <>
                  Nothing is booked with <span className="text-foreground">{email}</span>. Check the
                  spelling, or pick a time now.
                </>
              }
              action={
                <Link
                  href="/"
                  className="inline-flex h-10 items-center rounded-pill bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                >
                  See open times
                </Link>
              }
            />
          </div>
        ) : (
          <BookingList key={email.toLowerCase()} email={email} initial={page} />
        )}
      </div>
    </>
  );
}
