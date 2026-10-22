import { randomUUID } from "node:crypto";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { pool, withTransaction, type Queryable } from "@/lib/db";
import { HttpError, isObject, parseJson } from "@/lib/http";
import {
  findStoredResponse,
  requestHash,
  storeResponse,
  type StoredResponse,
} from "@/lib/idempotency";
import { recordAttempt } from "@/lib/rate-limit";

export type BookingStatus = "confirmed" | "cancelled";

export type Booking = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: BookingStatus;
  created_at: string;
};

type BookingRow = Omit<Booking, "created_at"> & { created_at: Date };

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    slot_id: row.slot_id,
    name: row.name,
    email: row.email,
    status: row.status,
    created_at: row.created_at.toISOString(),
  };
}

export type NewBooking = { slot_id: string; name: string; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (value === undefined || value === null) throw new HttpError(400, `${field} is required`);
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  if (value.trim() === "") throw new HttpError(400, `${field} must not be empty`);
  return value;
}

export function parseNewBooking(body: unknown): NewBooking {
  if (!isObject(body)) throw new HttpError(400, "request body must be a JSON object");
  const slot_id = requiredString(body, "slot_id");
  const name = requiredString(body, "name").trim();
  const email = requiredString(body, "email").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, "email must be a valid email address");
  return { slot_id, name, email };
}

export async function createBooking(input: NewBooking, db: Queryable = pool): Promise<Booking> {
  const slot = await db.query<{ started: boolean }>(
    "select start_at <= now() as started from slots where id = $1",
    [input.slot_id],
  );
  if (slot.rowCount === 0) throw new HttpError(404, "slot not found");
  if (slot.rows[0].started) throw new HttpError(400, "slot has already started");

  // The partial unique index decides who wins a race for the same slot.
  const { rows } = await db.query<BookingRow>(
    `insert into bookings (id, slot_id, name, email, status)
     values ($1, $2, $3, $4, 'confirmed')
     on conflict (slot_id) where status = 'confirmed' do nothing
     returning id, slot_id, name, email, status, created_at`,
    [randomUUID(), input.slot_id, input.name, input.email],
  );
  if (rows.length === 0) throw new HttpError(409, "slot already booked");
  return toBooking(rows[0]);
}

// The email an attempt counts against: present even when other fields are invalid.
function attemptEmail(body: unknown): string | null {
  if (!isObject(body) || typeof body.email !== "string") return null;
  return body.email.trim().toLowerCase() || null;
}

// The whole POST /bookings pipeline, shared by the API route and the web page.
// With an Idempotency-Key, every outcome (201, 400, 404, 409) is stored in the
// same transaction, so a retry gets back exactly what the first request got.
// A replay is served before the rate limiter: a retry isn't a new attempt.
// Every other request that names an email counts, failed ones included (the
// spec's level 5), so the limit is checked before field validation.
export async function submitBooking(text: string, key: string | null): Promise<StoredResponse> {
  const hash = key ? requestHash(text) : "";
  return withTransaction(async (client) => {
    if (key) {
      const stored = await findStoredResponse(client, key, hash);
      if (stored) return stored;
    }
    let res: StoredResponse;
    try {
      const body = parseJson(text);
      const email = attemptEmail(body);
      if (email) await recordAttempt(client, email);
      res = { status: 201, body: await createBooking(parseNewBooking(body), client) };
    } catch (err) {
      // A 429 rolls back and is never stored, so the same key can go through
      // once the window frees up.
      if (!(err instanceof HttpError) || err.status === 429) throw err;
      res = { status: err.status, body: { error: err.message } };
    }
    if (key) await storeResponse(client, key, hash, res);
    return res;
  });
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { rows } = await pool.query<BookingRow>(
    "select id, slot_id, name, email, status, created_at from bookings where id = $1",
    [id],
  );
  return rows[0] ? toBooking(rows[0]) : null;
}

// Cancelling frees the slot: the unique index only covers confirmed bookings.
export async function cancelBooking(id: string): Promise<Booking> {
  const { rows } = await pool.query<BookingRow>(
    `update bookings set status = 'cancelled'
     where id = $1 and status = 'confirmed'
     returning id, slot_id, name, email, status, created_at`,
    [id],
  );
  if (rows[0]) return toBooking(rows[0]);
  if (!(await getBooking(id))) throw new HttpError(404, "booking not found");
  throw new HttpError(409, "booking already cancelled");
}

export type BookingQuery = { email: string; limit: number; cursor: string | null };

export function parseBookingQuery(params: URLSearchParams): BookingQuery {
  const email = params.get("email")?.trim().toLowerCase();
  if (!email) throw new HttpError(400, "email is required");

  const rawLimit = params.get("limit");
  let limit = 10;
  if (rawLimit !== null) {
    limit = /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
    if (!(limit >= 1 && limit <= 50)) throw new HttpError(400, "limit must be an integer from 1 to 50");
  }

  const cursor = params.get("cursor");
  if (cursor === "") throw new HttpError(400, "cursor is invalid");
  return { email, limit, cursor };
}

export type BookingPage = { bookings: Booking[]; next_cursor: string | null };

export async function listBookings({ email, limit, cursor }: BookingQuery): Promise<BookingPage> {
  const after = cursor === null ? "0" : decodeCursor(cursor);
  const { rows } = await pool.query<BookingRow & { seq: string }>(
    `select seq, id, slot_id, name, email, status, created_at from bookings
     where email = $1 and seq > $2
     order by seq
     limit $3`,
    [email, after, limit + 1],
  );
  const page = rows.slice(0, limit);
  return {
    bookings: page.map(toBooking),
    next_cursor: rows.length > limit ? encodeCursor(page[page.length - 1].seq) : null,
  };
}
