/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are untyped JSON under test */
import type { Api, Level, Res } from "@/lib/dev/api-eval";

/*
 * Labeled cases for `bun run eval` and /dev/eval, one level of the spec each.
 * Every case starts from POST /reset with SLOTS, so cases never see each
 * other's bookings or rate-limit attempts.
 */

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");

export const SLOTS = [
  { id: "s2", provider: "Dr Bello", start: hoursFromNow(48), end: hoursFromNow(48.5) },
  { id: "s1", provider: "Dr Ade", start: hoursFromNow(24), end: hoursFromNow(24.5) },
  { id: "s3", provider: "Dr Ade", start: hoursFromNow(72), end: hoursFromNow(72.5) },
  { id: "past", provider: "Dr Ade", start: "2020-01-01T09:00:00Z", end: "2020-01-01T09:30:00Z" },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    provider: "Dr Page",
    start: hoursFromNow(100 + i),
    end: hoursFromNow(100.5 + i),
  })),
];

export const resetFixture = (api: Api) => api("POST", "/reset", { slots: SLOTS });

/** A booking attempt made before the request under test. Defaults: "Ada Obi", given<i>@example.com. */
export type Given = { slot: string; name?: string; email?: string; key?: string; cancel?: boolean };

export type RequestCase = {
  level: Level;
  name: string;
  given?: Given[];
  method: "GET" | "POST" | "DELETE";
  /** `{0}` stands for the id of the first given booking, and so on. */
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  status: number;
  /** One more thing the response must show, and how the board labels it. */
  check?: [label: string, ok: (res: Res, given: Res[]) => boolean];
};

/** Multi-step cases. `run` throws on the first broken expectation, or returns what it saw. */
export type ScriptCase = {
  level: Level;
  kind: "flow" | "race";
  name: string;
  expected: string;
  /** Races repeat, since one clean round proves little about a race. */
  rounds?: number;
  run: (api: Api) => Promise<string>;
};

export function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const ids = (res: Res) => (res.body?.slots ?? res.body?.bookings ?? []).map((x: any) => x.id).join(",");
const ada = { slot_id: "s1", name: "Ada Obi", email: "ada@example.com" };

export const REQUEST_CASES: RequestCase[] = [
  // L1: list, book, look up
  { level: "L1", name: "Reset with past slots", method: "POST", path: "/reset", body: { slots: SLOTS }, status: 200 },
  {
    level: "L1", name: "List slots", method: "GET", path: "/slots", status: 200,
    check: ["earliest first, all available", (r) =>
      ids(r) === "past,s1,s2,s3,p0,p1,p2,p3,p4" && r.body.slots.every((s: any) => s.available === true)],
  },
  {
    level: "L1", name: "Slots echo start and end verbatim", method: "GET", path: "/slots?provider=Dr%20Bello", status: 200,
    check: ["s2 exactly as sent", (r) => JSON.stringify(r.body.slots) === JSON.stringify([{ ...SLOTS[0], available: true }])],
  },
  {
    level: "L1", name: "Provider filter is exact", method: "GET", path: "/slots?provider=Dr%20Ade", status: 200,
    check: ["past, s1, s3", (r) => ids(r) === "past,s1,s3"],
  },
  {
    level: "L1", name: "Provider filter is case-sensitive", method: "GET", path: "/slots?provider=dr%20ade", status: 200,
    check: ["no slots", (r) => r.body.slots.length === 0],
  },
  {
    level: "L1", name: "Book a free slot", method: "POST", path: "/bookings", body: ada, status: 201,
    check: ["confirmed, fields echoed", (r) =>
      r.body.status === "confirmed" && r.body.slot_id === "s1" && r.body.name === "Ada Obi" &&
      r.body.email === "ada@example.com" && typeof r.body.id === "string" && !Number.isNaN(Date.parse(r.body.created_at))],
  },
  {
    level: "L1", name: "Look up a booking", given: [{ slot: "s1" }], method: "GET", path: "/bookings/{0}", status: 200,
    check: ["same as created", (r, g) => JSON.stringify(r.body) === JSON.stringify(g[0]!.body)],
  },
  {
    level: "L1", name: "A booked slot is unavailable", given: [{ slot: "s1" }], method: "GET", path: "/slots", status: 200,
    check: ["s1 unavailable", (r) => r.body.slots.find((s: any) => s.id === "s1")?.available === false],
  },
  { level: "L1", name: "Unknown booking id", method: "GET", path: "/bookings/does-not-exist", status: 404 },
  { level: "L1", name: "Unknown slot", method: "POST", path: "/bookings", body: { ...ada, slot_id: "nope" }, status: 404 },

  // L2: API key and validation
  { level: "L2", name: "No API key on GET /slots", method: "GET", path: "/slots", headers: { "x-api-key": "" }, status: 401 },
  { level: "L2", name: "Wrong API key on GET /slots", method: "GET", path: "/slots", headers: { "x-api-key": "wrong" }, status: 401 },
  { level: "L2", name: "No API key on POST /reset", method: "POST", path: "/reset", body: { slots: [] }, headers: { "x-api-key": "" }, status: 401 },
  { level: "L2", name: "No API key on POST /bookings", method: "POST", path: "/bookings", body: ada, headers: { "x-api-key": "" }, status: 401 },
  {
    level: "L2", name: "No API key on DELETE /bookings/{id}", given: [{ slot: "s1" }], method: "DELETE", path: "/bookings/{0}",
    headers: { "x-api-key": "" }, status: 401,
  },
  { level: "L2", name: "Body is not JSON", method: "POST", path: "/bookings", body: "{not json", status: 400 },
  { level: "L2", name: "Body is an array", method: "POST", path: "/bookings", body: [ada], status: 400 },
  { level: "L2", name: "Missing slot_id", method: "POST", path: "/bookings", body: { name: "Ada", email: "a1@example.com" }, status: 400 },
  { level: "L2", name: "Missing name", method: "POST", path: "/bookings", body: { slot_id: "s1", email: "a2@example.com" }, status: 400 },
  { level: "L2", name: "Missing email", method: "POST", path: "/bookings", body: { slot_id: "s1", name: "Ada" }, status: 400 },
  { level: "L2", name: "Blank name", method: "POST", path: "/bookings", body: { ...ada, name: "   " }, status: 400 },
  { level: "L2", name: "Name is a number", method: "POST", path: "/bookings", body: { ...ada, name: 42 }, status: 400 },
  { level: "L2", name: "slot_id is a number", method: "POST", path: "/bookings", body: { ...ada, slot_id: 1 }, status: 400 },
  { level: "L2", name: "Email without @", method: "POST", path: "/bookings", body: { ...ada, email: "not-an-email" }, status: 400 },
  { level: "L2", name: "Email without a dot in the domain", method: "POST", path: "/bookings", body: { ...ada, email: "ada@example" }, status: 400 },
  { level: "L2", name: "Email with a space", method: "POST", path: "/bookings", body: { ...ada, email: "a da@example.com" }, status: 400 },
  { level: "L2", name: "Slot already started", method: "POST", path: "/bookings", body: { ...ada, slot_id: "past" }, status: 400 },
  {
    level: "L2", name: "Idempotency-Key over 255 characters", method: "POST", path: "/bookings", body: ada,
    headers: { "idempotency-key": "k".repeat(256) }, status: 400,
  },
  {
    level: "L2", name: "Name trimmed, email trimmed and lower-cased", method: "POST", path: "/bookings",
    body: { slot_id: "s1", name: "  Ada Obi  ", email: "  Ada@Example.COM " }, status: 201,
    check: ["Ada Obi, ada@example.com", (r) => r.body.name === "Ada Obi" && r.body.email === "ada@example.com"],
  },

  // L3: no double booking, and cancel
  { level: "L3", name: "Book a slot someone holds", given: [{ slot: "s1" }], method: "POST", path: "/bookings", body: ada, status: 409 },
  {
    level: "L3", name: "Cancel a booking", given: [{ slot: "s2" }], method: "DELETE", path: "/bookings/{0}", status: 200,
    check: ["the booking, now cancelled", (r, g) => JSON.stringify(r.body) === JSON.stringify({ ...g[0]!.body, status: "cancelled" })],
  },
  { level: "L3", name: "Cancel twice", given: [{ slot: "s2", cancel: true }], method: "DELETE", path: "/bookings/{0}", status: 409 },
  { level: "L3", name: "Cancel an unknown booking", method: "DELETE", path: "/bookings/does-not-exist", status: 404 },
  {
    level: "L3", name: "A cancelled slot is available", given: [{ slot: "s2", cancel: true }], method: "GET", path: "/slots", status: 200,
    check: ["s2 available", (r) => r.body.slots.find((s: any) => s.id === "s2")?.available === true],
  },
  {
    level: "L3", name: "Book a freed slot", given: [{ slot: "s2", cancel: true }], method: "POST", path: "/bookings",
    body: { ...ada, slot_id: "s2" }, status: 201,
    check: ["a new booking id", (r, g) => r.body.id !== g[0]!.body.id],
  },
  {
    level: "L3", name: "Lookup shows a cancel", given: [{ slot: "s2", cancel: true }], method: "GET", path: "/bookings/{0}", status: 200,
    check: ["status cancelled", (r) => r.body.status === "cancelled"],
  },

  // L4: idempotency and pagination
  {
    level: "L4", name: "Retry with the same Idempotency-Key", given: [{ slot: "s1", email: "ada@example.com", key: "same" }],
    method: "POST", path: "/bookings", body: ada, headers: { "idempotency-key": "same" }, status: 201,
    check: ["the first response, byte for byte", (r, g) => JSON.stringify(r.body) === JSON.stringify(g[0]!.body)],
  },
  {
    level: "L4", name: "Same key, keys in another order", given: [{ slot: "s1", email: "ada@example.com", key: "order" }],
    method: "POST", path: "/bookings", body: { email: ada.email, slot_id: ada.slot_id, name: ada.name },
    headers: { "idempotency-key": "order" }, status: 201,
    check: ["same booking id", (r, g) => r.body.id === g[0]!.body.id],
  },
  {
    level: "L4", name: "Same key, different body", given: [{ slot: "s1", email: "ada@example.com", key: "diff" }],
    method: "POST", path: "/bookings", body: { ...ada, slot_id: "s2" }, headers: { "idempotency-key": "diff" }, status: 422,
  },
  {
    level: "L4", name: "First page of a person's bookings",
    given: [{ slot: "p0", email: "pat@example.com" }, { slot: "p1", email: "pat@example.com" }, { slot: "p2", email: "pat@example.com" }],
    method: "GET", path: "/bookings?email=pat@example.com&limit=2", status: 200,
    check: ["oldest two, with a next_cursor", (r, g) =>
      ids(r) === [g[0], g[1]].map((x) => x!.body.id).join(",") && typeof r.body.next_cursor === "string"],
  },
  {
    level: "L4", name: "Email lookup ignores case and spaces", given: [{ slot: "p0", email: "pat@example.com" }],
    method: "GET", path: `/bookings?email=${encodeURIComponent("  PAT@Example.com ")}`, status: 200,
    check: ["one booking", (r) => r.body.bookings.length === 1],
  },
  {
    level: "L4", name: "Cancelled bookings are listed", given: [{ slot: "p0", email: "pat@example.com", cancel: true }],
    method: "GET", path: "/bookings?email=pat@example.com", status: 200,
    check: ["one, cancelled", (r) => r.body.bookings.length === 1 && r.body.bookings[0].status === "cancelled"],
  },
  {
    level: "L4", name: "Unknown email", method: "GET", path: "/bookings?email=nobody@example.com", status: 200,
    check: ["empty, next_cursor null", (r) => r.body.bookings.length === 0 && r.body.next_cursor === null],
  },
  { level: "L4", name: "List without an email", method: "GET", path: "/bookings", status: 400 },
  { level: "L4", name: "limit=0", method: "GET", path: "/bookings?email=a@example.com&limit=0", status: 400 },
  { level: "L4", name: "limit=51", method: "GET", path: "/bookings?email=a@example.com&limit=51", status: 400 },
  { level: "L4", name: "limit=1.5", method: "GET", path: "/bookings?email=a@example.com&limit=1.5", status: 400 },
  { level: "L4", name: "Garbled cursor", method: "GET", path: "/bookings?email=a@example.com&cursor=!!!", status: 400 },

  // L5: rate limit
  {
    level: "L5", name: "6th attempt in a minute",
    given: [
      { slot: "s1", email: "rl@example.com" },
      { slot: "s2", email: "RL@example.com" },
      { slot: "nope", email: "rl@example.com" },
      { slot: "past", email: "rl@example.com" },
      { slot: "s1", email: "rl@example.com" },
    ],
    method: "POST", path: "/bookings", body: { ...ada, slot_id: "s3", email: " rl@EXAMPLE.com " }, status: 429,
    check: ["Retry-After 1-60 s", (r) => /^\d+$/.test(r.headers.get("retry-after") ?? "") && +r.headers.get("retry-after")! >= 1 && +r.headers.get("retry-after")! <= 60],
  },
  {
    level: "L5", name: "Invalid input counts toward the limit",
    given: Array.from({ length: 5 }, () => ({ slot: "s1", name: "", email: "bad@example.com" })),
    method: "POST", path: "/bookings", body: { ...ada, email: "bad@example.com" }, status: 429,
  },
  {
    level: "L5", name: "Another email is not limited",
    given: Array.from({ length: 5 }, () => ({ slot: "nope", email: "rl@example.com" })),
    method: "POST", path: "/bookings", body: { ...ada, email: "other@example.com" }, status: 201,
  },
  {
    level: "L5", name: "An idempotent replay is not a new attempt",
    given: [
      { slot: "s1", email: "rl@example.com", key: "rl-replay" },
      ...Array.from({ length: 4 }, () => ({ slot: "nope", email: "rl@example.com" })),
    ],
    method: "POST", path: "/bookings", body: { ...ada, email: "rl@example.com" }, headers: { "idempotency-key": "rl-replay" }, status: 201,
    check: ["the stored booking", (r, g) => r.body.id === g[0]!.body.id],
  },
];

const statuses = (results: Res[]) => results.map((r) => r.status).sort().join(" ");

export const SCRIPT_CASES: ScriptCase[] = [
  {
    level: "L1", kind: "flow", name: "Reset deletes every booking", expected: "old booking 404, every slot free",
    run: async (api) => {
      await resetFixture(api);
      const b = await api("POST", "/bookings", ada);
      await resetFixture(api);
      const got = await api("GET", `/bookings/${b.body.id}`);
      expect(got.status === 404, `old booking still answers ${got.status}`);
      const slots = await api("GET", "/slots");
      expect(slots.body.slots.every((s: any) => s.available), "a slot is still taken");
      return "old booking 404, every slot free";
    },
  },
  {
    level: "L3", kind: "race", name: "25 parallel bookings for one slot", expected: "one 201, 24 × 409", rounds: 5,
    run: async (api) => {
      await resetFixture(api);
      const results = await Promise.all(Array.from({ length: 25 }, (_, i) =>
        api("POST", "/bookings", { slot_id: "s1", name: `Racer ${i}`, email: `racer${i}@example.com` })));
      const won = results.filter((r) => r.status === 201).length;
      const lost = results.filter((r) => r.status === 409).length;
      expect(won === 1 && lost === 24, `${won} × 201, ${lost} × 409`);
      return "one 201, 24 × 409";
    },
  },
  {
    level: "L3", kind: "race", name: "10 parallel cancels of one booking", expected: "one 200, 9 × 409", rounds: 5,
    run: async (api) => {
      await resetFixture(api);
      const b = await api("POST", "/bookings", { ...ada, slot_id: "s3" });
      const results = await Promise.all(Array.from({ length: 10 }, () => api("DELETE", `/bookings/${b.body.id}`)));
      expect(statuses(results) === `200 ${"409 ".repeat(9).trim()}`, statuses(results));
      return "one 200, 9 × 409";
    },
  },
  {
    level: "L4", kind: "race", name: "10 parallel POSTs with one Idempotency-Key", expected: "10 identical 201s, one booking", rounds: 5,
    run: async (api) => {
      await resetFixture(api);
      const key = { "idempotency-key": `race-${crypto.randomUUID()}` };
      const results = await Promise.all(Array.from({ length: 10 }, () => api("POST", "/bookings", ada, key)));
      expect(results.every((r) => r.status === 201), statuses(results));
      expect(results.every((r) => JSON.stringify(r.body) === JSON.stringify(results[0]!.body)), "replays differ");
      const list = await api("GET", "/bookings?email=ada@example.com");
      expect(list.body.bookings.length === 1, `${list.body.bookings.length} bookings stored`);
      return "10 identical 201s, one booking";
    },
  },
  {
    level: "L4", kind: "flow", name: "Cursor pages through 5 bookings, 2 at a time", expected: "pages 2/2/1, oldest first",
    run: async (api) => {
      await resetFixture(api);
      const made: string[] = [];
      for (const i of [0, 1, 2, 3, 4]) {
        made.push((await api("POST", "/bookings", { slot_id: `p${i}`, name: "Pat", email: i % 2 ? "PAT@Example.com" : "pat@example.com" })).body.id);
        if (i === 1) await api("POST", "/bookings", { ...ada, email: "other@example.com" });
      }
      const sizes: number[] = [];
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res: Res = await api("GET", `/bookings?email=pat@example.com&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        expect(res.status === 200, `page ${sizes.length + 1} answered ${res.status}`);
        sizes.push(res.body.bookings.length);
        seen.push(...res.body.bookings.map((b: any) => b.id));
        cursor = res.body.next_cursor;
      } while (cursor && sizes.length < 10);
      expect(sizes.join("/") === "2/2/1", `pages ${sizes.join("/")}`);
      expect(seen.join() === made.join(), "wrong order or members");
      return "pages 2/2/1, oldest first";
    },
  },
  {
    level: "L4", kind: "flow", name: "A replayed 409 stays 409 after the slot frees", expected: "409, then 409, then 201 without the key",
    run: async (api) => {
      await resetFixture(api);
      const holder = await api("POST", "/bookings", { ...ada, email: "holder@example.com" });
      const key = { "idempotency-key": `conflict-${crypto.randomUUID()}` };
      const first = await api("POST", "/bookings", ada, key);
      expect(first.status === 409, `first try ${first.status}`);
      await api("DELETE", `/bookings/${holder.body.id}`);
      const replay = await api("POST", "/bookings", ada, key);
      expect(replay.status === 409, `replay ${replay.status}`);
      const fresh = await api("POST", "/bookings", ada);
      expect(fresh.status === 201, `without the key ${fresh.status}`);
      return "409, then 409, then 201 without the key";
    },
  },
  {
    level: "L5", kind: "race", name: "10 parallel attempts for one email", expected: "5 through (404), 5 × 429", rounds: 5,
    run: async (api) => {
      await resetFixture(api);
      const results = await Promise.all(Array.from({ length: 10 }, () =>
        api("POST", "/bookings", { slot_id: "nope", name: "Ada", email: "burst@example.com" })));
      expect(statuses(results) === "404 404 404 404 404 429 429 429 429 429", statuses(results));
      return "5 through (404), 5 × 429";
    },
  },
];
