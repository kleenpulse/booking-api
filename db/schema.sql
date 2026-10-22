-- Idempotent: safe to run more than once.

create table if not exists slots (
  id        text primary key,
  provider  text not null,
  -- The raw strings are echoed back verbatim; Postgres would re-serialise
  -- "09:00:00Z" as "09:00:00.000Z".
  start_raw text not null,
  end_raw   text not null,
  start_at  timestamptz not null,
  end_at    timestamptz not null
);

create table if not exists bookings (
  id         text primary key,
  slot_id    text not null references slots(id) on delete cascade,
  name       text not null,
  email      text not null,
  status     text not null check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- At most one confirmed booking per slot, enforced by the database so it
-- holds under concurrent requests.
create unique index if not exists one_confirmed_per_slot
  on bookings (slot_id) where status = 'confirmed';
