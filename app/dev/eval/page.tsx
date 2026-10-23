import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ApiEvalBoard } from "@/components/dev-eval/board";
import { readApiEval } from "@/lib/dev/api-eval";

export const metadata: Metadata = { title: "API eval", robots: { index: false, follow: false } };

/** Dev-only scorecard; reads `.test-results/api-eval.json` written by `bun run eval` or the Run button. */
export default function ApiEvalPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16">
      <Suspense>
        <Board />
      </Suspense>
    </main>
  );
}

async function Board() {
  // The report file changes with every run: read it at request time.
  await connection();
  return <ApiEvalBoard report={await readApiEval()} />;
}
