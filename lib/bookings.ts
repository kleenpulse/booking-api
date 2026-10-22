import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import { HttpError, isObject } from "@/lib/http";

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

export async function createBooking(input: NewBooking): Promise<Booking> {
  const slot = await pool.query<{ started: boolean }>(
    "select start_at <= now() as started from slots where id = $1",
    [input.slot_id],
  );
  if (slot.rowCount === 0) throw new HttpError(404, "slot not found");
  if (slot.rows[0].started) throw new HttpError(400, "slot has already started");

  // The partial unique index decides who wins a race for the same slot.
  const { rows } = await pool.query<BookingRow>(
    `insert into bookings (id, slot_id, name, email, status)
     values ($1, $2, $3, $4, 'confirmed')
     on conflict (slot_id) where status = 'confirmed' do nothing
     returning id, slot_id, name, email, status, created_at`,
    [randomUUID(), input.slot_id, input.name, input.email],
  );
  if (rows.length === 0) throw new HttpError(409, "slot already booked");
  return toBooking(rows[0]);
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
