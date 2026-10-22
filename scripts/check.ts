// Contract checks against a running API.
// Usage: BASE_URL=https://... API_KEY=... bun run check
// WARNING: calls POST /reset, which wipes all slots and bookings.
/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are untyped JSON under test */
export {};

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.API_KEY ?? "";

type Res = { status: number; body: any; headers: Headers };

async function api(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { "content-type": "application/json", "x-api-key": API_KEY, ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}
  return { status: res.status, body: parsed, headers: res.headers };
}

function expect(cond: unknown, message: string, detail?: unknown): asserts cond {
  if (!cond) throw new Error(`${message}${detail === undefined ? "" : `\n      got: ${JSON.stringify(detail)}`}`);
}

function expectError(res: Res, status: number) {
  expect(res.status === status, `expected ${status}, got ${res.status}`, res.body);
  expect(typeof res.body?.error === "string", "error body must be {error: string}", res.body);
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");

const SLOTS = [
  { id: "s2", provider: "Dr Bello", start: hoursFromNow(48), end: hoursFromNow(48.5) },
  { id: "s1", provider: "Dr Ade", start: hoursFromNow(24), end: hoursFromNow(24.5) },
  { id: "s3", provider: "Dr Ade", start: hoursFromNow(72), end: hoursFromNow(72.5) },
  { id: "past", provider: "Dr Ade", start: "2020-01-01T09:00:00Z", end: "2020-01-01T09:30:00Z" },
];

const reset = () => api("POST", "/reset", { slots: SLOTS });

const tests: [string, () => Promise<void>][] = [
  ["L1 reset accepts slots, including past ones", async () => {
    const res = await reset();
    expect(res.status === 200, `expected 200, got ${res.status}`, res.body);
  }],

  ["L1 slots are sorted by start, available, echoed verbatim", async () => {
    await reset();
    const res = await api("GET", "/slots");
    expect(res.status === 200, `expected 200, got ${res.status}`, res.body);
    const ids = res.body.slots.map((s: any) => s.id);
    expect(JSON.stringify(ids) === JSON.stringify(["past", "s1", "s2", "s3"]), "wrong order", ids);
    for (const slot of res.body.slots) {
      const sent = SLOTS.find((s) => s.id === slot.id)!;
      expect(slot.provider === sent.provider && slot.start === sent.start && slot.end === sent.end, "slot not echoed verbatim", slot);
      expect(slot.available === true, "fresh slot should be available", slot);
    }
  }],

  ["L1 provider filter is an exact match", async () => {
    await reset();
    const res = await api("GET", "/slots?provider=" + encodeURIComponent("Dr Ade"));
    const ids = res.body.slots.map((s: any) => s.id);
    expect(JSON.stringify(ids) === JSON.stringify(["past", "s1", "s3"]), "wrong filter result", ids);
    const none = await api("GET", "/slots?provider=dr%20ade");
    expect(none.body.slots.length === 0, "filter must be case-sensitive exact match", none.body);
  }],

  ["L1 book a slot, then look it up", async () => {
    await reset();
    const res = await api("POST", "/bookings", { slot_id: "s1", name: "Ada Obi", email: "ada@example.com" });
    expect(res.status === 201, `expected 201, got ${res.status}`, res.body);
    const b = res.body;
    expect(typeof b.id === "string" && b.id.length > 0, "id must be a non-empty string", b);
    expect(b.slot_id === "s1" && b.name === "Ada Obi" && b.email === "ada@example.com", "fields not echoed", b);
    expect(b.status === "confirmed", "status must be confirmed", b);
    expect(!Number.isNaN(Date.parse(b.created_at)), "created_at must be a date-time", b);

    const got = await api("GET", `/bookings/${b.id}`);
    expect(got.status === 200, `expected 200, got ${got.status}`, got.body);
    expect(JSON.stringify(got.body) === JSON.stringify(b), "lookup differs from created booking", got.body);

    const slots = await api("GET", "/slots");
    const s1 = slots.body.slots.find((s: any) => s.id === "s1");
    expect(s1.available === false, "booked slot must be unavailable", s1);
  }],

  ["L1 unknown booking id returns 404", async () => {
    expectError(await api("GET", "/bookings/does-not-exist"), 404);
  }],

  ["L1 unknown slot returns 404", async () => {
    await reset();
    expectError(await api("POST", "/bookings", { slot_id: "nope", name: "Ada", email: "ada@example.com" }), 404);
  }],

  ["L1 reset deletes every booking", async () => {
    await reset();
    const b = await api("POST", "/bookings", { slot_id: "s2", name: "Ada", email: "ada@example.com" });
    await reset();
    expectError(await api("GET", `/bookings/${b.body.id}`), 404);
    const slots = await api("GET", "/slots");
    expect(slots.body.slots.every((s: any) => s.available), "all slots should be free after reset", slots.body);
  }],

  ["L2 missing or wrong API key returns 401 on every route", async () => {
    const routes: [string, string, unknown?][] = [
      ["POST", "/reset", { slots: SLOTS }],
      ["GET", "/slots"],
      ["POST", "/bookings", { slot_id: "s1", name: "Ada", email: "ada@example.com" }],
      ["GET", "/bookings/anything"],
      ["DELETE", "/bookings/anything"],
      ["GET", "/bookings?email=ada@example.com"],
    ];
    for (const [method, path, body] of routes) {
      expectError(await api(method, path, body, { "x-api-key": "" }), 401);
      expectError(await api(method, path, body, { "x-api-key": API_KEY + "x" }), 401);
    }
  }],

  ["L2 invalid booking input returns 400", async () => {
    await reset();
    const good = { slot_id: "s1", name: "Ada", email: "ada@example.com" };
    const bad: unknown[] = [
      "{not json",
      [good],
      { name: "Ada", email: "ada@example.com" },
      { slot_id: "s1", email: "ada@example.com" },
      { slot_id: "s1", name: "Ada" },
      { ...good, slot_id: "" },
      { ...good, name: "" },
      { ...good, name: "   " },
      { ...good, email: "  " },
      { ...good, name: 42 },
      { ...good, email: ["ada@example.com"] },
      { ...good, slot_id: 1 },
      { ...good, email: "not-an-email" },
      { ...good, email: "ada@example" },
      { ...good, email: "a da@example.com" },
    ];
    for (const [i, raw] of bad.entries()) {
      // A fresh email per body: failed attempts count toward the level 5 limit.
      const body = (raw as any)?.email === good.email ? { ...(raw as object), email: `l2-${i}@example.com` } : raw;
      const res = await api("POST", "/bookings", body);
      expect(res.status === 400, `expected 400 for ${JSON.stringify(body)}, got ${res.status}`, res.body);
      expect(typeof res.body?.error === "string", "error body must be {error: string}", res.body);
    }
    const slots = await api("GET", "/slots");
    expect(slots.body.slots.every((s: any) => s.available), "rejected input must not book anything", slots.body);
  }],

  ["L2 slot that already started returns 400", async () => {
    await reset();
    expectError(await api("POST", "/bookings", { slot_id: "past", name: "Ada", email: "ada@example.com" }), 400);
  }],

  ["L2 name and email are trimmed, email lower-cased", async () => {
    await reset();
    const res = await api("POST", "/bookings", { slot_id: "s1", name: "  Ada Obi  ", email: "  Ada@Example.COM " });
    expect(res.status === 201, `expected 201, got ${res.status}`, res.body);
    expect(res.body.name === "Ada Obi" && res.body.email === "ada@example.com", "fields not normalised", res.body);
  }],

  ["L3 25 parallel bookings for one slot: exactly one 201, the rest 409", async () => {
    await reset();
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        api("POST", "/bookings", { slot_id: "s1", name: `Racer ${i}`, email: `racer${i}@example.com` })),
    );
    const statuses = results.map((r) => r.status);
    const won = results.filter((r) => r.status === 201);
    expect(won.length === 1, `expected exactly one 201, got ${won.length}`, statuses);
    for (const r of results) if (r.status !== 201) expectError(r, 409);

    const got = await api("GET", `/bookings/${won[0].body.id}`);
    expect(got.status === 200 && got.body.status === "confirmed", "winner must be stored as confirmed", got.body);
  }],

  ["L3 cancel frees the slot; second cancel 409; unknown id 404", async () => {
    await reset();
    const b = await api("POST", "/bookings", { slot_id: "s2", name: "Ada", email: "ada@example.com" });
    expect(b.status === 201, `expected 201, got ${b.status}`, b.body);

    const cancelled = await api("DELETE", `/bookings/${b.body.id}`);
    expect(cancelled.status === 200, `expected 200, got ${cancelled.status}`, cancelled.body);
    expect(JSON.stringify(cancelled.body) === JSON.stringify({ ...b.body, status: "cancelled" }),
      "cancel must return the booking with status cancelled", cancelled.body);

    const got = await api("GET", `/bookings/${b.body.id}`);
    expect(got.body.status === "cancelled", "lookup must show cancelled", got.body);

    const slots = await api("GET", "/slots");
    expect(slots.body.slots.find((s: any) => s.id === "s2").available === true, "cancelled slot must be available", slots.body);

    const rebook = await api("POST", "/bookings", { slot_id: "s2", name: "Bayo", email: "bayo@example.com" });
    expect(rebook.status === 201 && rebook.body.id !== b.body.id, "freed slot must be bookable again", rebook.body);

    expectError(await api("DELETE", `/bookings/${b.body.id}`), 409);
    expectError(await api("DELETE", "/bookings/does-not-exist"), 404);
  }],

  ["L3 10 parallel cancels of one booking: exactly one 200, the rest 409", async () => {
    await reset();
    const b = await api("POST", "/bookings", { slot_id: "s3", name: "Ada", email: "ada@example.com" });
    const results = await Promise.all(Array.from({ length: 10 }, () => api("DELETE", `/bookings/${b.body.id}`)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200).length === 1, "expected exactly one 200", statuses);
    for (const r of results) if (r.status !== 200) expectError(r, 409);
  }],

  ["L4 10 parallel POSTs with one Idempotency-Key: one booking, identical responses", async () => {
    await reset();
    const key = { "idempotency-key": `same-${crypto.randomUUID()}` };
    const body = { slot_id: "s1", name: "Ada", email: "ada@example.com" };
    const results = await Promise.all(Array.from({ length: 10 }, () => api("POST", "/bookings", body, key)));
    for (const r of results) {
      expect(r.status === 201, `expected every response to be 201, got ${r.status}`, results.map((x) => x.status));
      expect(JSON.stringify(r.body) === JSON.stringify(results[0].body), "replay must match the original exactly", r.body);
    }
    const list = await api("GET", "/bookings?email=ada@example.com");
    expect(list.body.bookings.length === 1, "exactly one booking must exist", list.body);

    const reordered = await api("POST", "/bookings", { email: body.email, slot_id: body.slot_id, name: body.name }, key);
    expect(reordered.status === 201 && reordered.body.id === results[0].body.id, "key order must not change the request", reordered.body);
  }],

  ["L4 same key with a different body returns 422; a replayed 409 stays 409", async () => {
    await reset();
    const key = { "idempotency-key": `diff-${crypto.randomUUID()}` };
    const first = await api("POST", "/bookings", { slot_id: "s2", name: "Ada", email: "ada@example.com" }, key);
    expect(first.status === 201, `expected 201, got ${first.status}`, first.body);
    expectError(await api("POST", "/bookings", { slot_id: "s3", name: "Ada", email: "ada@example.com" }, key), 422);

    const holder = await api("POST", "/bookings", { slot_id: "s1", name: "Bayo", email: "bayo@example.com" });
    const conflictKey = { "idempotency-key": `conflict-${crypto.randomUUID()}` };
    const attempt = { slot_id: "s1", name: "Ada", email: "ada@example.com" };
    expectError(await api("POST", "/bookings", attempt, conflictKey), 409);
    await api("DELETE", `/bookings/${holder.body.id}`);
    expectError(await api("POST", "/bookings", attempt, conflictKey), 409);
    const fresh = await api("POST", "/bookings", attempt);
    expect(fresh.status === 201, "without the key, the freed slot must be bookable", fresh.body);
  }],

  ["L4 bookings by email: oldest first, cursor pages, case-insensitive", async () => {
    const extra = Array.from({ length: 5 }, (_, i) =>
      ({ id: `p${i}`, provider: "Dr Page", start: hoursFromNow(100 + i), end: hoursFromNow(100.5 + i) }));
    await api("POST", "/reset", { slots: [...SLOTS, ...extra] });
    const created: any[] = [];
    for (const [i, slot] of extra.entries()) {
      const email = i % 2 ? "PAT@Example.com" : "pat@example.com";
      created.push((await api("POST", "/bookings", { slot_id: slot.id, name: "Pat", email })).body);
      if (i === 1) await api("POST", "/bookings", { slot_id: "s1", name: "Other", email: "other@example.com" });
    }
    await api("DELETE", `/bookings/${created[2].id}`);

    const seen: any[] = [];
    const sizes: number[] = [];
    let cursor: string | null = null;
    do {
      const res: Res = await api("GET", `/bookings?email=${encodeURIComponent("  Pat@EXAMPLE.com ")}&limit=2` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
      expect(res.status === 200, `expected 200, got ${res.status}`, res.body);
      sizes.push(res.body.bookings.length);
      seen.push(...res.body.bookings);
      cursor = res.body.next_cursor;
    } while (cursor && sizes.length < 10);
    expect(JSON.stringify(sizes) === JSON.stringify([2, 2, 1]), "expected pages of 2/2/1", sizes);
    expect(JSON.stringify(seen.map((b) => b.id)) === JSON.stringify(created.map((b) => b.id)), "wrong order or members", seen);
    expect(seen[2].status === "cancelled", "cancelled bookings must be listed", seen[2]);

    const all = await api("GET", "/bookings?email=pat@example.com");
    expect(all.body.bookings.length === 5 && all.body.next_cursor === null, "default limit must return all 5", all.body);
    const none = await api("GET", "/bookings?email=nobody@example.com");
    expect(none.status === 200 && none.body.bookings.length === 0 && none.body.next_cursor === null, "unknown email lists nothing", none.body);
  }],

  ["L4 bad email, limit or cursor returns 400", async () => {
    const bad = [
      "/bookings", "/bookings?email=", "/bookings?email=%20%20",
      ...["0", "51", "abc", "1.5", "", "-1", "1e1"].map((l) => `/bookings?email=a@example.com&limit=${l}`),
      ...["", "!!!", "YWJj", "LTE"].map((c) => `/bookings?email=a@example.com&cursor=${c}`),
    ];
    for (const path of bad) {
      const res = await api("GET", path);
      expect(res.status === 400, `expected 400 for ${path}, got ${res.status}`, res.body);
      expect(typeof res.body?.error === "string", "error body must be {error: string}", res.body);
    }
  }],

  ["L5 6th attempt for one email in a minute returns 429 with Retry-After; failures count", async () => {
    await reset();
    const key = { "idempotency-key": `rl-${crypto.randomUUID()}` };
    const first = { slot_id: "s1", name: "Ada", email: "rl@example.com" };
    const attempts: [unknown, Record<string, string>, number][] = [
      [first, key, 201],
      [{ ...first, email: "RL@Example.com" }, {}, 409],
      [{ ...first, slot_id: "nope" }, {}, 404],
      [{ ...first, slot_id: "past" }, {}, 400],
      [{ ...first, slot_id: "s2" }, {}, 201],
    ];
    for (const [body, headers, status] of attempts) {
      const res = await api("POST", "/bookings", body, headers);
      expect(res.status === status, `expected ${status}, got ${res.status}`, res.body);
    }

    const limited = await api("POST", "/bookings", { ...first, slot_id: "s3", email: " rl@EXAMPLE.com " });
    expectError(limited, 429);
    const retryAfter = limited.headers.get("retry-after") ?? "";
    expect(/^\d+$/.test(retryAfter) && +retryAfter >= 1 && +retryAfter <= 60, "Retry-After must be whole seconds, 1-60", retryAfter);

    const replay = await api("POST", "/bookings", first, key);
    expect(replay.status === 201, "an idempotent replay is not a new attempt", replay.body);
    const other = await api("POST", "/bookings", { ...first, slot_id: "s3", email: "other@example.com" });
    expect(other.status === 201, "another email must not be limited", other.body);
  }],

  ["L5 invalid input counts too; parallel attempts can't slip past the limit", async () => {
    await reset();
    for (let i = 0; i < 5; i++) {
      expectError(await api("POST", "/bookings", { slot_id: "s1", name: "", email: "bad@example.com" }), 400);
    }
    expectError(await api("POST", "/bookings", { slot_id: "s1", name: "Ada", email: "BAD@example.com" }), 429);

    const results = await Promise.all(Array.from({ length: 10 }, () =>
      api("POST", "/bookings", { slot_id: "nope", name: "Ada", email: "burst@example.com" })));
    const statuses = results.map((r) => r.status).sort();
    expect(JSON.stringify(statuses) === JSON.stringify([404, 404, 404, 404, 404, 429, 429, 429, 429, 429]),
      "expected exactly 5 attempts through and 5 limited", statuses);
  }],
];

const only = process.argv[2];
let failed = 0;
for (const [name, run] of tests) {
  if (only && !name.startsWith(only)) continue;
  try {
    await run();
    console.log(`  pass  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n      ${(err as Error).message}`);
  }
}
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
