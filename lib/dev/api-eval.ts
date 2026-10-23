import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Dev-only API eval: the labeled cases in test/fixtures/eval/ run against the
 * real route handlers in a separate `bun` process, on a private local Postgres
 * (lib/dev/eval-postgres.ts) instead of the app's database: every case starts
 * with POST /reset. This module holds the shared types and the report file; it
 * never touches a database itself.
 */

export const LEVELS = ["L1", "L2", "L3", "L4", "L5"] as const;
export type Level = (typeof LEVELS)[number];
export const SPLITS = ["all", ...LEVELS] as const;
export type EvalSplit = (typeof SPLITS)[number];

/** Columns on the board: the run before this one, and this one. */
export type EvalRun = "last" | "now";

export type Rate = { hits: number; total: number };

export type EvalMetrics = {
  /** Cases where every expectation held. */
  pass: Rate;
  status: Rate;
  /** Error responses shaped `{"error": string}`. */
  errorBody: Rate;
  /** Single-request cases with a body or header check, and it held. */
  body: Rate;
  /** Multi-step flows that held. */
  flows: Rate;
  /** Rounds of parallel races that held: one winner, one cancel, one replay, the limit. */
  races: Rate;
  /** Per API call, in process: handler plus round trips to the eval database. */
  p50ms: number;
  p95ms: number;
  /** Responses with status 500. */
  crashes: number;
};

export type CaseAnswer = { value: string; ok: boolean };

export type EvalCase = {
  id: string;
  level: Level;
  kind: "request" | "flow" | "race";
  input: string;
  expected: string;
  answers: Partial<Record<EvalRun, CaseAnswer>>;
};

export type ApiEvalReport = {
  schema: 1;
  at: string;
  ms: number;
  /** Which database the cases ran on, e.g. "local Postgres 18.4". */
  db: string;
  runs: EvalRun[];
  metrics: Record<EvalSplit, Partial<Record<EvalRun, EvalMetrics>>>;
  cases: EvalCase[];
};

/** A labeled API call result, as fixtures see it. */
export type Res = {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are untyped JSON under test
  body: any;
  headers: Headers;
};

export type Api = (
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<Res>;

const FILE = path.join(process.cwd(), ".test-results", "api-eval.json");

export async function writeApiEval(report: ApiEvalReport): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(report, null, 2));
}

export async function readApiEval(): Promise<ApiEvalReport | null> {
  try {
    const data = JSON.parse(await readFile(FILE, "utf8")) as ApiEvalReport;
    return data?.schema === 1 ? data : null;
  } catch {
    return null;
  }
}
