import { DELETE as deleteBooking, GET as getBooking } from "@/app/(api)/bookings/[id]/route";
import { GET as listBookings, POST as postBooking } from "@/app/(api)/bookings/route";
import { POST as postReset } from "@/app/(api)/reset/route";
import { GET as getSlots } from "@/app/(api)/slots/route";
import {
  LEVELS,
  SPLITS,
  type Api,
  type ApiEvalReport,
  type EvalCase,
  type EvalMetrics,
  type Level,
  type Rate,
  type Res,
} from "@/lib/dev/api-eval";
import { REQUEST_CASES, resetFixture, SCRIPT_CASES, type Given } from "@/test/fixtures/eval/cases";

/*
 * Runs the labeled cases through the real route handlers, in process. Import
 * this only from scripts/eval-api.ts, after it has pointed DATABASE_URL at the
 * eval database: lib/db.ts reads it once, at import.
 */

type Outcome = {
  level: Level;
  kind: EvalCase["kind"];
  ok: boolean;
  status?: boolean;
  errorBody?: boolean;
  body?: boolean;
  rounds?: Rate;
  ms: number[];
  crashes: number;
};

function route(method: string, pathname: string, req: Request): Promise<Response> {
  const none = {};
  if (pathname === "/reset" && method === "POST") return postReset(req, none);
  if (pathname === "/slots" && method === "GET") return getSlots(req, none);
  if (pathname === "/bookings" && method === "POST") return postBooking(req, none);
  if (pathname === "/bookings" && method === "GET") return listBookings(req, none);
  const match = /^\/bookings\/([^/]+)$/.exec(pathname);
  if (match) {
    const ctx = { params: Promise.resolve({ id: decodeURIComponent(match[1]!) }) };
    if (method === "GET") return getBooking(req, ctx);
    if (method === "DELETE") return deleteBooking(req, ctx);
  }
  throw new Error(`No route for ${method} ${pathname}`);
}

/** The API as fixtures call it, timing each call and counting 500s into `out`. */
function apiFor(out: Pick<Outcome, "ms" | "crashes">): Api {
  return async (method, path, body, headers = {}) => {
    const url = new URL(path, "http://eval.local");
    const req = new Request(url, {
      method,
      headers: { "content-type": "application/json", "x-api-key": process.env.API_KEY ?? "", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const started = performance.now();
    const res = await route(method, url.pathname, req);
    const text = await res.text();
    out.ms.push(performance.now() - started);
    if (res.status === 500) out.crashes += 1;
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}
    return { status: res.status, body: parsed, headers: res.headers };
  };
}

function given(api: Api, g: Given, i: number): Promise<Res> {
  const body = { slot_id: g.slot, name: g.name ?? "Ada Obi", email: g.email ?? `given${i}@example.com` };
  return api("POST", "/bookings", body, g.key ? { "idempotency-key": g.key } : {});
}

const rate = (): Rate => ({ hits: 0, total: 0 });
function tally(r: Rate, ok: boolean | undefined) {
  if (ok === undefined) return;
  r.total += 1;
  if (ok) r.hits += 1;
}
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : 0;
}

function measure(outcomes: Outcome[]): EvalMetrics {
  const m: EvalMetrics = {
    pass: rate(),
    status: rate(),
    errorBody: rate(),
    body: rate(),
    flows: rate(),
    races: rate(),
    p50ms: 0,
    p95ms: 0,
    crashes: 0,
  };
  for (const o of outcomes) {
    tally(m.pass, o.ok);
    tally(m.status, o.status);
    tally(m.errorBody, o.errorBody);
    tally(m.body, o.body);
    if (o.kind === "flow") tally(m.flows, o.ok);
    if (o.rounds) {
      m.races.hits += o.rounds.hits;
      m.races.total += o.rounds.total;
    }
    m.crashes += o.crashes;
  }
  const ms = outcomes.flatMap((o) => o.ms);
  m.p50ms = round(quantile(ms, 0.5));
  m.p95ms = round(quantile(ms, 0.95));
  return m;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function runApiEval({ db, previous }: { db: string; previous: ApiEvalReport | null }): Promise<ApiEvalReport> {
  const started = performance.now();
  const outcomes: Outcome[] = [];
  const cases: EvalCase[] = [];

  for (const c of REQUEST_CASES) {
    const o: Outcome = { level: c.level, kind: "request", ok: false, ms: [], crashes: 0 };
    const api = apiFor(o);
    let value: string;
    try {
      await resetFixture(api);
      const made: Res[] = [];
      for (const [i, g] of (c.given ?? []).entries()) {
        const res = await given(api, g, i);
        made.push(res);
        if (g.cancel) await api("DELETE", `/bookings/${res.body?.id}`);
      }
      const path = c.path.replace(/\{(\d+)\}/g, (_, n: string) => String(made[Number(n)]?.body?.id ?? "missing"));
      const res = await api(c.method, path, c.body, c.headers);
      o.status = res.status === c.status;
      if (res.status >= 400) o.errorBody = typeof res.body?.error === "string";
      if (c.check) {
        try {
          o.body = c.check[1](res, made) === true;
        } catch {
          o.body = false;
        }
      }
      o.ok = o.status && o.errorBody !== false && o.body !== false;
      value = [res.status, res.body?.error, o.body === false && `not ${c.check![0]}`, o.errorBody === false && "no {error}"]
        .filter(Boolean)
        .join(" · ");
    } catch (err) {
      value = `threw: ${message(err)}`;
    }
    outcomes.push(o);
    cases.push({
      id: `${c.level}:${c.name}`,
      level: c.level,
      kind: "request",
      input: `${c.method} ${c.path} — ${c.name}`,
      expected: [c.status, c.check?.[0]].filter(Boolean).join(" · "),
      answers: { now: { value, ok: o.ok } },
    });
  }

  for (const c of SCRIPT_CASES) {
    const rounds = c.rounds ?? 1;
    const o: Outcome = { level: c.level, kind: c.kind, ok: false, ms: [], crashes: 0 };
    if (c.kind === "race") o.rounds = rate();
    const api = apiFor(o);
    let held = 0;
    let seen = "";
    let firstMiss: string | null = null;
    for (let i = 0; i < rounds; i++) {
      try {
        seen = await c.run(api);
        held += 1;
      } catch (err) {
        firstMiss ??= message(err);
      }
    }
    if (o.rounds) o.rounds = { hits: held, total: rounds };
    o.ok = held === rounds;
    outcomes.push(o);
    const count = rounds > 1 ? `${held}/${rounds} rounds` : "";
    cases.push({
      id: `${c.level}:${c.name}`,
      level: c.level,
      kind: c.kind,
      input: rounds > 1 ? `${c.name} (×${rounds})` : c.name,
      expected: c.expected,
      answers: { now: { value: [count, firstMiss ?? seen].filter(Boolean).join(" · "), ok: o.ok } },
    });
  }

  const metrics = {} as ApiEvalReport["metrics"];
  for (const split of SPLITS) {
    const now = measure(split === "all" ? outcomes : outcomes.filter((o) => o.level === split));
    const last = previous?.metrics[split]?.now;
    metrics[split] = last ? { last, now } : { now };
  }
  // A case's last answer is whatever the previous run said for the same id.
  const before = new Map(previous?.cases.map((c) => [c.id, c.answers.now]));
  for (const c of cases) {
    const last = before.get(c.id);
    if (last) c.answers = { last, ...c.answers };
  }

  return {
    schema: 1,
    at: new Date().toISOString(),
    ms: Math.round(performance.now() - started),
    db,
    runs: previous ? ["last", "now"] : ["now"],
    metrics,
    cases: cases.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)),
  };
}
