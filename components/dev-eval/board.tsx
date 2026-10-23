"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Play, X } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { runEval } from "@/app/dev/eval/actions";
import { EmptyState } from "@/components/empty-state";
import type { ApiEvalReport, EvalCase, EvalMetrics, EvalRun, EvalSplit, Rate } from "@/lib/dev/api-eval";
import { TAB_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const RUN_LABEL: Record<EvalRun, string> = { last: "Last run", now: "This run" };

const SPLIT_META: Record<EvalSplit, { label: string; note: string }> = {
  all: { label: "All", note: "Every level of the spec, start to finish." },
  L1: { label: "L1", note: "List, book, look up. Start and end come back verbatim." },
  L2: { label: "L2", note: "API key first, then validation. Every error is {\"error\": ...}." },
  L3: { label: "L3", note: "No double booking. The unique index decides, not the app." },
  L4: { label: "L4", note: "Idempotent retries and cursor pages that never shift." },
  L5: { label: "L5", note: "Five attempts per email a minute. Failures count too." },
};
const SPLIT_ORDER: EvalSplit[] = ["all", "L1", "L2", "L3", "L4", "L5"];

/**
 * Barrel roll: the notes are faces of a cube turning on its long axis. The
 * axis sits half a line behind the text, so a face turned 90° lands exactly
 * where the next line would be and the two never overlap. `dir` is the tab's
 * travel (1 = rightwards, rolls up). MotionConfig makes it a crossfade under
 * reduced motion.
 */
const ROLL_LINE = 20;
const ROLL = { duration: 0.5, ease: [0.65, 0, 0.35, 1] } as const;
const roll: Variants = {
  enter: (dir: number) => ({ rotateX: dir * -90, opacity: 0.4 }),
  center: { rotateX: 0, opacity: 1, transition: ROLL },
  exit: (dir: number) => ({ rotateX: dir * 90, opacity: 0.4, transition: ROLL }),
};

function SplitNote({ split, dir }: { split: EvalSplit; dir: number }) {
  return (
    <p className="min-w-0 flex-1 text-[13px] text-ink-2">
      <span className="sr-only" aria-live="polite">
        {SPLIT_META[split].note}
      </span>
      <span
        aria-hidden
        className="grid h-8 items-center overflow-hidden perspective-normal mask-[linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]"
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.span
            key={split}
            custom={dir}
            variants={roll}
            initial="enter"
            animate="center"
            exit="exit"
            style={{
              lineHeight: `${ROLL_LINE}px`,
              transformOrigin: `50% 50% -${ROLL_LINE / 2}px`,
              backfaceVisibility: "hidden",
              willChange: "transform, opacity",
            }}
            className="col-start-1 row-start-1 truncate"
          >
            {SPLIT_META[split].note}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  );
}

/** Pill toggle in the header nav's style: one pressed option, a shared highlight. */
function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const layoutId = React.useId();
  return (
    <div
      role="group"
      aria-label={label}
      className="flex max-w-full shrink-0 items-center overflow-x-auto rounded-pill bg-sheet p-1 ring-1 ring-border dark:bg-background/40 dark:ring-glass-border"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative isolate inline-flex h-8 items-center rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-inverse-foreground dark:text-signal" : "text-ink-2 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={TAB_SPRING}
                aria-hidden
                style={{ borderRadius: 9999 }}
                className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type Row = { key: keyof EvalMetrics; label: string; lower?: boolean; unit?: string };
const GROUPS: { title: string; hint: string; rows: Row[] }[] = [
  {
    title: "Requests",
    hint: "One request each, after a reset and a few bookings",
    rows: [
      { key: "status", label: "Status code" },
      { key: "errorBody", label: "Error body {error}" },
      { key: "body", label: "Response body" },
    ],
  },
  {
    title: "Scenarios",
    hint: "Multi-step flows, and races run five rounds each",
    rows: [
      { key: "flows", label: "Flows" },
      { key: "races", label: "Race rounds held" },
      { key: "crashes", label: "500s", lower: true },
    ],
  },
  {
    title: "Cost",
    hint: "Per API call: handler plus a local Postgres",
    rows: [
      { key: "p50ms", label: "Median latency", lower: true, unit: "ms" },
      { key: "p95ms", label: "p95 latency", lower: true, unit: "ms" },
    ],
  },
];

const isRate = (v: unknown): v is Rate => typeof v === "object" && v !== null && "total" in v;
const ratio = (r: Rate) => (r.total ? r.hits / r.total : null);

function display(value: Rate | number, unit?: string): string {
  if (isRate(value)) {
    const r = ratio(value);
    return r === null ? "–" : `${Math.round(r * 100)}%`;
  }
  return unit ? `${value}${unit}` : String(value);
}

/** Comparable number per metric; null when the split has no cases for it. */
function numeric(value: Rate | number): number | null {
  return isRate(value) ? ratio(value) : value;
}

function MetricRow({ row, metrics, runs }: { row: Row; metrics: Partial<Record<EvalRun, EvalMetrics>>; runs: EvalRun[] }) {
  const values = runs.map((r) => {
    const m = metrics[r];
    return m ? numeric(m[row.key]) : null;
  });
  const present = values.filter((v): v is number => v !== null);
  const best = present.length > 1 ? (row.lower ? Math.min(...present) : Math.max(...present)) : null;
  const tie = best !== null && present.every((v) => v === best);
  return (
    <tr className="border-t border-border/70 dark:border-glass-border">
      <th scope="row" className="py-2 pr-3 text-left text-[13px] font-normal text-ink-2">
        {row.label}
      </th>
      {runs.map((r, i) => {
        const m = metrics[r];
        const v = values[i];
        const winner = !tie && v !== null && v === best;
        const rateRow = m ? isRate(m[row.key]) : false;
        return (
          <td key={r} className="py-2 pl-3 text-right">
            <span className={cn("tabular font-mono text-[13px]", winner || r === "now" ? "text-foreground" : "text-ink-2")}>
              {m ? display(m[row.key], row.unit) : "–"}
            </span>
            {rateRow && v !== null && (
              <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-border" aria-hidden>
                <span
                  className={cn("block h-full rounded-full", v < 1 ? "bg-critical" : winner ? "bg-signal" : "bg-ink-3")}
                  style={{ width: `${v * 100}%` }}
                />
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function Scorecard({
  group,
  metrics,
  runs,
  i,
}: {
  group: (typeof GROUPS)[number];
  metrics: Partial<Record<EvalRun, EvalMetrics>>;
  runs: EvalRun[];
  i: number;
}) {
  return (
    <section className="bento entrance col-span-12 p-5 md:col-span-6 lg:col-span-4" style={{ ["--i" as string]: i }}>
      <h2 className="font-display text-[17px] leading-tight">{group.title}</h2>
      <p className="mt-1 text-[13px] text-ink-2">{group.hint}</p>
      <table className="mt-4 w-full">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Metric
            </th>
            {runs.map((r) => (
              <th key={r} scope="col" className="readout pb-1 pl-3 text-right font-normal">
                {RUN_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <MetricRow key={row.key} row={row} metrics={metrics} runs={runs} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Headline({ metrics }: { metrics: Partial<Record<EvalRun, EvalMetrics>> }) {
  const now = metrics.now;
  const last = metrics.last;
  if (!now) return null;
  const stats: { label: string; key: keyof EvalMetrics; lower?: boolean; unit?: string }[] = [
    { label: "Cases passed", key: "pass" },
    { label: "Status codes", key: "status" },
    { label: "Race rounds held", key: "races" },
    { label: "p95 latency", key: "p95ms", lower: true, unit: "ms" },
  ];
  return (
    <section className="bento entrance col-span-12 p-5" style={{ ["--i" as string]: 1 }}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {stats.map(({ label, key, lower, unit }) => {
          const n = numeric(now[key]);
          const l = last ? numeric(last[key]) : null;
          const delta = n !== null && l !== null ? (unit ? Math.round(n - l) : Math.round((n - l) * 100)) : null;
          const better = delta !== null && (lower ? delta < 0 : delta > 0);
          const worse = delta !== null && (lower ? delta > 0 : delta < 0);
          return (
            <div key={key} className="min-w-0">
              <p className="readout">{label}</p>
              <p className="mt-2 font-display text-kpi leading-none tabular">{display(now[key], unit)}</p>
              <p className={cn("mt-1.5 tabular text-[12px]", better ? "text-ok" : worse ? "text-critical" : "text-ink-2")}>
                {delta === null
                  ? last
                    ? "no cases here"
                    : "no earlier run"
                  : `${delta > 0 ? "+" : ""}${delta}${unit ?? " pts"} vs last run`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type CaseFilter = "misses" | "changed" | "all";
const FILTERS: { id: CaseFilter; label: string }[] = [
  { id: "misses", label: "Misses" },
  { id: "changed", label: "Changed since last run" },
  { id: "all", label: "All cases" },
];

function Verdict({ answer }: { answer: EvalCase["answers"][EvalRun] }) {
  if (!answer) return <span className="text-ink-3">–</span>;
  return (
    <span className="flex items-start gap-1.5">
      {answer.ok ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-label="Held" />
      ) : (
        <X className="mt-0.5 size-3.5 shrink-0 text-critical" aria-label="Missed" />
      )}
      <span className={cn("min-w-0 wrap-anywhere", !answer.ok && "text-foreground")}>{answer.value}</span>
    </span>
  );
}

const PAGE_SIZE = 10;

/**
 * Page numbers to show (0-based), null marking a gap. Past seven pages it
 * always returns seven slots, so the pager keeps its width while you page.
 */
function pageWindow(count: number, page: number): (number | null)[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (count <= 7) return range(0, count - 1);
  if (page <= 3) return [...range(0, 4), null, count - 1];
  if (page >= count - 4) return [0, null, ...range(count - 5, count - 1)];
  return [0, null, page - 1, page, page + 1, null, count - 1];
}

const pagerButton =
  "grid size-8 place-items-center rounded-pill text-[12px] tabular outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

function Cases({ cases, runs, split }: { cases: EvalCase[]; runs: EvalRun[]; split: EvalSplit }) {
  const [filter, setFilter] = React.useState<CaseFilter>("misses");
  const shown = cases.filter((c) => {
    if (filter === "misses") return !c.answers.now?.ok;
    if (filter === "changed") return c.answers.last && (c.answers.last.ok !== c.answers.now?.ok || c.answers.last.value !== c.answers.now?.value);
    return true;
  });
  // The page belongs to one split + filter; switching either starts again at
  // page one. A rerun keeps the page, clamped if the list got shorter.
  const listKey = `${split}:${filter}`;
  const [paging, setPaging] = React.useState({ key: listKey, page: 0 });
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const page = paging.key === listKey ? Math.min(paging.page, pageCount - 1) : 0;
  const start = page * PAGE_SIZE;
  const rows = shown.slice(start, start + PAGE_SIZE);
  const headRef = React.useRef<HTMLDivElement>(null);
  const goTo = (next: number) => {
    setPaging({ key: listKey, page: Math.max(0, Math.min(next, pageCount - 1)) });
    // Paging from the bottom of a long page: bring the new page's first row back into view.
    const head = headRef.current;
    if (head && head.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      head.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  };
  return (
    <section className="bento entrance col-span-12 p-5" style={{ ["--i" as string]: 5 }}>
      <div ref={headRef} className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] leading-tight">Cases</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            {shown.length} of {cases.length} in this split · cases live in <code className="font-mono">test/fixtures/eval/</code>
          </p>
        </div>
        <Pills label="Filter cases" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-[13px] text-ink-2">
          {filter === "misses" ? "Every case in this split held." : filter === "changed" ? "Nothing changed since the last run." : "Nothing here."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-190 text-[13px]">
            <thead>
              <tr className="text-left">
                <th scope="col" className="readout pb-2 font-normal">
                  Level
                </th>
                <th scope="col" className="readout pb-2 pl-3 font-normal">
                  Case
                </th>
                <th scope="col" className="readout pb-2 pl-3 font-normal">
                  Expected
                </th>
                {runs.map((r) => (
                  <th key={r} scope="col" className="readout pb-2 pl-3 font-normal">
                    {RUN_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border/70 align-top dark:border-glass-border">
                  <td className="py-2.5 font-mono text-[11px] text-ink-2">
                    {c.level}
                    {c.kind !== "request" && <span className="mt-0.5 block uppercase">{c.kind}</span>}
                  </td>
                  <td className="max-w-85 py-2.5 pl-3 wrap-anywhere">{c.input}</td>
                  <td className="max-w-55 py-2.5 pl-3 text-ink-2 wrap-anywhere">{c.expected}</td>
                  {runs.map((r) => (
                    <td key={r} className="max-w-65 py-2.5 pl-3 text-ink-2">
                      <Verdict answer={c.answers[r]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <nav
          aria-label="Case pages"
          className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 dark:border-glass-border"
        >
          <p className="readout tabular" aria-live="polite">
            {rows.length > 1 ? `${start + 1}–${start + rows.length}` : start + 1} of {shown.length}
          </p>
          <div className="flex items-center gap-1 rounded-pill bg-sheet p-1 ring-1 ring-border dark:bg-background/40 dark:ring-glass-border">
            <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => goTo(page - 1)} className={cn(pagerButton, "text-ink-2 hover:text-foreground")}>
              <ChevronLeft className="size-4" />
            </button>
            {pageWindow(pageCount, page).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-[12px] text-ink-2">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-label={`Page ${n + 1}`}
                  aria-current={n === page ? "page" : undefined}
                  onClick={() => goTo(n)}
                  className={cn(pagerButton, n === page ? "bg-inverse text-inverse-foreground dark:bg-signal-soft dark:text-signal" : "text-ink-2 hover:text-foreground")}
                >
                  {n + 1}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={page === pageCount - 1}
              onClick={() => goTo(page + 1)}
              className={cn(pagerButton, "text-ink-2 hover:text-foreground")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}

function RunButton({ onRun, running }: { onRun: () => void; running: boolean }) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={running}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-pill bg-inverse px-5 text-sm font-medium text-inverse-foreground outline-none transition-[opacity,transform] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      {running ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />}
      {running ? "Running…" : "Run eval"}
    </button>
  );
}

const seconds = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

function ago(iso: string, now: number): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function subscribeClock(onTick: () => void) {
  const id = window.setInterval(onTick, 30_000);
  return () => window.clearInterval(id);
}
// Quantised, so the snapshot stays stable between ticks; null while server rendering.
const useNow = () => React.useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 30_000) * 30_000, () => null);

/**
 * What a finished run changed. The API is deterministic, so an unchanged page
 * is the common case: say so outright, or the click looks ignored.
 */
function runSummary(prev: ApiEvalReport | null, next: ApiEvalReport): string {
  if (!prev) return `${next.cases.length} cases scored.`;
  const changes: string[] = [];
  for (const split of SPLIT_ORDER) {
    const before = prev.metrics[split]?.now;
    const after = next.metrics[split]?.now;
    if (!before || !after) continue;
    for (const group of GROUPS) {
      for (const row of group.rows) {
        const a = before[row.key];
        const b = after[row.key];
        if (!isRate(a) || !isRate(b) || display(a) === display(b)) continue;
        changes.push(`${SPLIT_META[split].label} ${row.label.toLowerCase()} ${display(a)} → ${display(b)}`);
      }
    }
  }
  if (changes.length === 0) return "No score changed since the last run.";
  return changes.length === 1 ? changes[0]! : `${changes[0]}, and ${changes.length - 1} more.`;
}

export function ApiEvalBoard({ report: initial }: { report: ApiEvalReport | null }) {
  const [report, setReport] = React.useState(initial);
  const [running, startRun] = React.useTransition();
  const [notice, setNotice] = React.useState<{ tone: "ok" | "critical"; text: string } | null>(null);
  const [{ split, dir }, setView] = React.useState<{ split: EvalSplit; dir: number }>({ split: "all", dir: 1 });
  const setSplit = (next: EvalSplit) => setView({ split: next, dir: SPLIT_ORDER.indexOf(next) > SPLIT_ORDER.indexOf(split) ? 1 : -1 });
  const now = useNow();

  const start = () => {
    setNotice(null);
    startRun(async () => {
      const result = await runEval();
      if (!result.ok) {
        setNotice({ tone: "critical", text: result.error });
        return;
      }
      setNotice({ tone: "ok", text: `Eval finished in ${seconds(result.report.ms)}. ${runSummary(report, result.report)}` });
      setReport(result.report);
    });
  };

  const metrics = report?.metrics[split] ?? {};
  const runs = report?.runs ?? [];

  return (
    <>
      <header className="entrance flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="readout">Dev only</p>
          <h1 className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] leading-[0.96] tracking-[-0.04em]">
            API eval<span className="text-signal">.</span>
          </h1>
          <p className="mt-4 truncate text-[13px] text-ink-2" aria-live="polite">
            {running
              ? `Scoring ${report ? `${report.cases.length} cases` : "every case"} on a local Postgres…`
              : report
                ? `Last run ${now === null ? "" : ago(report.at, now)} · ${seconds(report.ms)} · ${report.db}`
                : "Labeled requests, flows and races for every level of the spec"}
          </p>
        </div>
        <RunButton onRun={start} running={running} />
      </header>

      {notice && (
        <p
          role={notice.tone === "critical" ? "alert" : "status"}
          className={cn(
            "mt-4 rounded-card px-4 py-2.5 text-[13px]",
            notice.tone === "critical" ? "bg-critical/10 text-critical" : "bg-ok/10 text-ok",
          )}
        >
          {notice.text}
        </p>
      )}

      {/* The old scores stay readable while a run is out, but dim so they read as stale. */}
      <div aria-busy={running} className={cn("mt-8 grid grid-cols-12 gap-4 transition-opacity duration-300", running && "opacity-50")}>
        {!report ? (
          <div className="bento entrance col-span-12 p-5" style={{ ["--i" as string]: 1 }}>
            <EmptyState
              title="No eval yet"
              body={
                <>
                  Run it here, or from a terminal with <code className="font-mono text-foreground">bun run eval</code>. The
                  first run sets up a local Postgres, so it takes a little longer.
                </>
              }
              action={<RunButton onRun={start} running={running} />}
            />
          </div>
        ) : (
          <>
            <div className="col-span-12 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Pills label="Spec level" options={SPLIT_ORDER.map((s) => ({ id: s, label: SPLIT_META[s].label }))} value={split} onChange={setSplit} />
              <SplitNote split={split} dir={dir} />
            </div>
            <Headline metrics={metrics} />
            {GROUPS.map((group, i) => (
              <Scorecard key={group.title} group={group} metrics={metrics} runs={runs} i={i + 2} />
            ))}
            <Cases cases={split === "all" ? report.cases : report.cases.filter((c) => c.level === split)} runs={runs} split={split} />
          </>
        )}
      </div>
    </>
  );
}
