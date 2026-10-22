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

export function parseNewBooking(body: unknown): NewBooking {
  if (!isObject(body)) throw new HttpError(400, "request body must be a JSON object");
  const { slot_id, name, email } = body;
  return { slot_id: String(slot_id), name: String(name), email: String(email) };
}

export async function createBooking(input: NewBooking): Promise<Booking> {
  const slot = await pool.query("select 1 from slots where id = $1", [input.slot_id]);
  if (slot.rowCount === 0) throw new HttpError(404, "slot not found");

  const { rows } = await pool.query<BookingRow>(
    `insert into bookings (id, slot_id, name, email, status)
     values ($1, $2, $3, $4, 'confirmed')
     returning id, slot_id, name, email, status, created_at`,
    [randomUUID(), input.slot_id, input.name, input.email],
  );
  return toBooking(rows[0]);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { rows } = await pool.query<BookingRow>(
    "select id, slot_id, name, email, status, created_at from bookings where id = $1",
    [id],
  );
  return rows[0] ? toBooking(rows[0]) : null;
}
