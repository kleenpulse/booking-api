import { pool, withTransaction } from "@/lib/db";
import { HttpError, isObject } from "@/lib/http";

export type Slot = { id: string; provider: string; start: string; end: string };
export type SlotWithAvailability = Slot & { available: boolean };

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function isDateTime(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

export function parseSlots(body: unknown): Slot[] {
  if (!isObject(body) || !Array.isArray(body.slots)) {
    throw new HttpError(400, "slots must be an array");
  }
  const seen = new Set<string>();
  return body.slots.map((slot: unknown, i) => {
    if (!isObject(slot)) throw new HttpError(400, `slots[${i}] must be an object`);
    const { id, provider, start, end } = slot;
    if (typeof id !== "string" || id === "" || typeof provider !== "string") {
      throw new HttpError(400, `slots[${i}] needs a string id and provider`);
    }
    if (!isDateTime(start) || !isDateTime(end)) {
      throw new HttpError(400, `slots[${i}] start and end must be ISO 8601 date-times`);
    }
    if (seen.has(id)) throw new HttpError(400, `duplicate slot id "${id}"`);
    seen.add(id);
    return { id, provider, start, end };
  });
}

export async function resetSlots(slots: Slot[]) {
  await withTransaction(async (client) => {
    await client.query("delete from idempotency_keys");
    await client.query("delete from bookings");
    await client.query("delete from slots");
    if (slots.length === 0) return;
    await client.query(
      `insert into slots (id, provider, start_raw, end_raw, start_at, end_at)
       select id, provider, s, e, s::timestamptz, e::timestamptz
       from unnest($1::text[], $2::text[], $3::text[], $4::text[]) as t(id, provider, s, e)`,
      [
        slots.map((s) => s.id),
        slots.map((s) => s.provider),
        slots.map((s) => s.start),
        slots.map((s) => s.end),
      ],
    );
  });
}

export async function listSlots(provider: string | null): Promise<SlotWithAvailability[]> {
  const { rows } = await pool.query(
    `select s.id, s.provider, s.start_raw, s.end_raw,
            not exists (
              select 1 from bookings b where b.slot_id = s.id and b.status = 'confirmed'
            ) as available
     from slots s
     where $1::text is null or s.provider = $1
     order by s.start_at, s.id`,
    [provider],
  );
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    start: r.start_raw,
    end: r.end_raw,
    available: r.available,
  }));
}
