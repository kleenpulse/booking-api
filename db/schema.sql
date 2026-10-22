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
  seq        bigserial unique,
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

create index if not exists bookings_email_seq on bookings (email, seq);

create table if not exists idempotency_keys (
  key          text primary key,
  request_hash text not null,
  status_code  int not null,
  body         json not null,
  created_at   timestamptz not null default now()
);

-- json, not jsonb: jsonb reorders keys, and a replay must match the original
-- response exactly. No-op once the column is already json.
alter table idempotency_keys alter column body type json using body::json;
