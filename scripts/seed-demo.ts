// Adds a week of demo appointments without touching existing slots or bookings
// (unlike POST /reset, which wipes everything). Safe to run more than once.
// Usage: bun run db:seed (reads DATABASE_URL from .env.local)
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const DAYS = 7;
const OFFSET = "+01:00"; // clinic time (West Africa Time, no DST)
const SLOT_MINUTES = 30;
const BOOKED_SHARE = 0.18;

// Each doctor keeps their own hours; lunch from 12:30 to 13:30 is kept free.
const DOCTORS = [
  { name: "Dr Ade", from: 8, to: 14, days: [1, 2, 3, 4, 5, 6] },
  { name: "Dr Bello", from: 9, to: 17, days: [1, 2, 3, 4, 5] },
  { name: "Dr Chukwu", from: 10, to: 16, days: [1, 3, 5, 6] },
  { name: "Dr Okafor", from: 8, to: 12, days: [2, 4, 6] },
  { name: "Dr Yusuf", from: 13, to: 18, days: [1, 2, 3, 4, 5] },
];

const PATIENTS = ["Amaka Eze", "Tunde Bakare", "Zainab Musa", "Chidi Nwosu", "Funke Adeyemi", "Ibrahim Sani", "Ngozi Okeke", "Segun Ajayi"];

// Seeded, so a rerun produces the same week and on-conflict skips it.
let state = 42;
const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const pad = (n: number) => String(n).padStart(2, "0");

// Calendar dates in clinic time, starting tomorrow.
function clinicDates(): { ymd: string; weekday: number }[] {
  const nowInClinic = new Date(Date.now() + 60 * 60 * 1000);
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.UTC(nowInClinic.getUTCFullYear(), nowInClinic.getUTCMonth(), nowInClinic.getUTCDate() + 1 + i));
    return { ymd: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, weekday: d.getUTCDay() };
  });
}

type Slot = { id: string; provider: string; start: string; end: string };

const slots: Slot[] = [];
for (const { ymd, weekday } of clinicDates()) {
  for (const doc of DOCTORS) {
    if (!doc.days.includes(weekday)) continue;
    for (let m = doc.from * 60; m + SLOT_MINUTES <= doc.to * 60; m += SLOT_MINUTES) {
      if (m >= 12 * 60 + 30 && m < 13 * 60 + 30) continue;
      // Not every half hour is offered: leaves natural gaps in the day.
      if (random() < 0.2) continue;
      const time = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
      slots.push({
        id: `${doc.name.slice(3).toLowerCase()}-${ymd}-${time(m).replace(":", "")}`,
        provider: doc.name,
        start: `${ymd}T${time(m)}:00${OFFSET}`,
        end: `${ymd}T${time(m + SLOT_MINUTES)}:00${OFFSET}`,
      });
    }
  }
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  const inserted = await client.query(
    `insert into slots (id, provider, start_raw, end_raw, start_at, end_at)
     select id, provider, s, e, s::timestamptz, e::timestamptz
     from unnest($1::text[], $2::text[], $3::text[], $4::text[]) as t(id, provider, s, e)
     on conflict (id) do nothing
     returning id`,
    [slots.map((s) => s.id), slots.map((s) => s.provider), slots.map((s) => s.start), slots.map((s) => s.end)],
  );

  // Book a share of the new slots so the board looks lived in.
  const fresh = inserted.rows.map((r) => r.id as string).filter(() => random() < BOOKED_SHARE);
  for (const slotId of fresh) {
    const name = PATIENTS[Math.floor(random() * PATIENTS.length)];
    const email = name.toLowerCase().replace(" ", ".") + "@example.com";
    await client.query(
      `insert into bookings (id, slot_id, name, email, status)
       values ($1, $2, $3, $4, 'confirmed')
       on conflict do nothing`,
      [randomUUID(), slotId, name, email],
    );
  }
  await client.query("commit");
  console.log(`${inserted.rowCount} of ${slots.length} slots added, ${fresh.length} booked`);
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  await client.end();
}
