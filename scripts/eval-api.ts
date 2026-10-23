// Scores the API on the labeled cases in test/fixtures/eval/ and writes
// .test-results/api-eval.json for /dev/eval. Dev only.
// Usage: bun run eval [--level L1..L5] [--misses]
// Every case starts with POST /reset, so the cases run on a private local
// Postgres (lib/dev/eval-postgres.ts), never on DATABASE_URL.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { readApiEval, SPLITS, writeApiEval, type ApiEvalReport, type EvalMetrics, type Rate } from "@/lib/dev/api-eval";
import { startEvalPostgres } from "@/lib/dev/eval-postgres";

// The one Bun API used here; the project doesn't ship @types/bun.
declare const Bun: {
  plugin(plugin: {
    name: string;
    setup(build: { module(id: string, load: () => { exports: Record<string, unknown>; loader: "object" }): void }): void;
  }): void;
};

// Route handlers call connection(), which throws outside a Next request.
Bun.plugin({
  name: "next-server-stub",
  setup(build) {
    build.module("next/server", () => ({ exports: { connection: async () => undefined }, loader: "object" }));
  },
});

function fail(step: string, err: unknown): never {
  console.error(`${step}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const pg = await startEvalPostgres().catch((err) => fail("Could not start the eval Postgres", err));
let report: ApiEvalReport;
try {
  const schema = new Client({ connectionString: pg.url });
  await schema.connect();
  await schema.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const version = (await schema.query<{ server_version: string }>("show server_version")).rows[0]!.server_version;
  await schema.end();

  // lib/db.ts reads these once, when the runner first imports it.
  process.env.DATABASE_URL = pg.url;
  process.env.API_KEY = `eval-${randomUUID()}`;
  const { runApiEval } = await import("@/lib/dev/api-eval-run");
  report = await runApiEval({ db: `local Postgres ${version}`, previous: await readApiEval() });
  await writeApiEval(report);
  // Closed first, or stopping the server drops its idle clients with an error.
  await (await import("@/lib/db")).pool.end();
} catch (err) {
  await pg.stop().catch(() => {});
  fail("The eval failed", err);
}
await pg.stop().catch((err) => console.error(`Could not stop the eval Postgres: ${err.message}`));

const args = process.argv.slice(2);
const only = args.includes("--level") ? args[args.indexOf("--level") + 1] : null;

const ROWS: [keyof EvalMetrics, string][] = [
  ["pass", "Cases passed"],
  ["status", "Status code"],
  ["errorBody", "Error body {error}"],
  ["body", "Response body"],
  ["flows", "Flows"],
  ["races", "Race rounds held"],
  ["p50ms", "Latency p50 ms"],
  ["p95ms", "Latency p95 ms"],
  ["crashes", "500s"],
];
const cell = (v: Rate | number | undefined) =>
  v === undefined ? "–" : typeof v === "number" ? String(v) : v.total ? `${Math.round((v.hits / v.total) * 100)}%` : "–";

console.log(`Eval database: ${report.db}`);
for (const split of SPLITS.filter((s) => !only || s === only)) {
  console.log(`\n${split.toUpperCase()}`);
  console.log(["metric".padEnd(24), ...report.runs.map((r) => (r === "now" ? "this run" : "last run").padStart(10))].join(""));
  for (const [key, label] of ROWS) {
    console.log([label.padEnd(24), ...report.runs.map((r) => cell(report.metrics[split][r]?.[key]).padStart(10))].join(""));
  }
}
if (args.includes("--misses")) {
  const misses = report.cases.filter((c) => (!only || c.level === only) && !c.answers.now?.ok);
  console.log(misses.length ? "\nMisses" : "\nNo misses");
  for (const c of misses) console.log(`  [${c.level}] ${c.input} → ${c.answers.now?.value} (want ${c.expected})`);
}
console.log(`\nWrote .test-results/api-eval.json in ${report.ms}ms`);
process.exit(0);
