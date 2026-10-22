import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
      <div className="bento entrance p-5">
        <EmptyState
          title="Nothing here"
          body="This page or booking does not exist. Check the link, or start again from the open times."
          action={
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-pill bg-inverse px-5 text-sm font-medium text-inverse-foreground outline-none transition-[background-color,transform] hover:bg-inverse/88 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              See open times
            </Link>
          }
        />
      </div>
    </main>
  );
}
