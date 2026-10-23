"use server";

import { spawn } from "node:child_process";
import { readApiEval, type ApiEvalReport } from "@/lib/dev/api-eval";

export type EvalRunResult = { ok: true; report: ApiEvalReport } | { ok: false; error: string };

// The cases run in their own process, on their own Postgres: this server's
// database pool is the app's, and every case starts with POST /reset.
function runScript(): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["scripts/eval-api.ts"], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", (err) => resolve({ code: null, stderr: `Could not start bun: ${err.message}` }));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

/** Dev only: re-scores the API on the labeled cases for /dev/eval. */
export async function runEval(): Promise<EvalRunResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Not found." };
  const { code, stderr } = await runScript();
  if (code !== 0) {
    const last = stderr.trim().split("\n").at(-1);
    return { ok: false, error: last || `The eval exited with code ${code}.` };
  }
  const report = await readApiEval();
  return report ? { ok: true, report } : { ok: false, error: "The eval finished but wrote no report." };
}
