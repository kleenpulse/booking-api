# Clinic Booking API

A booking API for a clinic, plus a small web page that uses it: see open slots, book one, and get a confirmation. Built for Task 1 of the Koya Cohort 4 assessment, following the [technical spec](https://koyaacademy.com/assessment-api) closely. All five levels are done.

- **Live app and API:** `https://koya-booking-api.vercel.app` (the API lives at the root, so this is also the API base URL)
- **Stack:** Next.js 16 (App Router, TypeScript), Postgres on Neon, deployed on Vercel

## Endpoints

Every request needs the `X-API-Key` header. A missing or wrong key returns `401`. Every error looks like `{"error": "<message>"}`.

| Method | Path | Level | What it does |
|---|---|---|---|
| `POST` | `/reset` | 1 | Deletes every booking and replaces all slots (past slots allowed) |
| `GET` | `/slots?provider=` | 1 | Every slot, earliest first, with `available`. `provider` is an exact match |
| `POST` | `/bookings` | 1–5 | Books a slot. Returns `201` with the booking |
| `GET` | `/bookings?email=&limit=&cursor=` | 4 | A person's bookings, oldest first, cursor pages |
| `GET` | `/bookings/{id}` | 1 | One booking, or `404` |
| `DELETE` | `/bookings/{id}` | 3 | Cancels a booking and frees the slot. `409` if already cancelled |

### Try it

```bash
BASE=https://koya-booking-api.vercel.app
KEY=<your-api-key>

curl -X POST $BASE/reset -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"slots":[{"id":"s1","provider":"Dr Ade","start":"2026-12-10T09:00:00Z","end":"2026-12-10T09:30:00Z"}]}'

curl $BASE/slots -H "X-API-Key: $KEY"

curl -X POST $BASE/bookings -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6f1c2a" \
  -d '{"slot_id":"s1","name":"Ada Obi","email":"ada@example.com"}'

curl "$BASE/bookings?email=ada@example.com&limit=10" -H "X-API-Key: $KEY"
```

## How each level works

**Level 1: list, book, look up.** Slots and bookings live in Postgres, so bookings are still there on the next request and after a cold start. `start` and `end` are stored as the exact strings you sent and returned unchanged.

**Level 2: API key and validation.** One shared handler wraps every route. It checks `X-API-Key` first (a constant-time compare) and turns every error into `{"error": ...}`. A booking needs `slot_id`, `name` and a valid `email`. Name and email are trimmed, and email is stored in lower case. An unknown slot is `404`, a slot that has already started is `400`.

**Level 3: no double booking, and cancel.** The database decides, not the app. A partial unique index allows one *confirmed* booking per slot:

```sql
create unique index one_confirmed_per_slot on bookings (slot_id) where status = 'confirmed';
```

The insert uses `on conflict do nothing`. If no row comes back, someone else got there first, and the answer is `409`. Checking first and then inserting would let two requests both pass the check. Cancelling only sets `status = 'cancelled'`, and since the index only covers confirmed bookings, the slot is free again.

**Level 4: idempotency and pagination.**
- With an `Idempotency-Key`, the request takes a Postgres advisory lock on that key, so retries that arrive at the same moment run one at a time. The first one does the work and saves its response (status and body) in the same transaction. Later ones get that saved response back: same status, same booking `id`. The same key with a different body returns `422`. The body is compared by a hash of its JSON with sorted keys, so key order doesn't matter.
- Pages use a cursor built from an increasing sequence number, not an offset, so new bookings never shift or repeat rows between pages. `limit` is 1 to 50 (default 10). The last page has `next_cursor: null`.

**Level 5: rate limit.** Each email gets 5 booking attempts in any 60 seconds (a sliding window), and failed attempts count. Attempts are stored in Postgres, and a lock per email stops parallel requests from all slipping under the limit. The 6th attempt returns `429` with `Retry-After` in whole seconds, which is when the oldest attempt in the window expires. Two details:
- An idempotent retry is answered before the limiter. A retry is not a new attempt, and the spec says it must get the same response.
- A `429` is not saved against the `Idempotency-Key`, so the same key can go through once the window frees up.

## The web page

`/` lists upcoming slots by day with a filter per doctor. You pick a time, enter your name and email, and land on a confirmation page at `/booking/{id}` where you can cancel. `/my-bookings` finds every booking for an email, with "Load more" following the API's cursor.

The page doesn't call the API over HTTP. It uses server actions that call the same `submitBooking` function as `POST /bookings`, so it gets exactly the same validation, rate limit, idempotency and double-booking guard, and the API key never reaches the browser. Each form submission carries its own idempotency key, so a double click can't book twice. Times are shown in the clinic's time zone (West Africa Time).

## Run it locally

You need [Bun](https://bun.sh) and a Postgres database (a free [Neon](https://neon.com) project works).

```bash
bun install
cp .env.example .env.local   # set DATABASE_URL and API_KEY
bun run db:setup             # creates the tables (safe to run again)
bun run db:seed              # optional: a week of demo slots, without deleting anything
bun run dev
```

## Tests

`scripts/check.ts` runs 20 contract checks against any running copy of the API: auth on every route, validation, 25 parallel bookings on one slot (exactly one `201`), 10 parallel requests with one idempotency key (one booking), pagination, and the rate limit (10 parallel attempts, exactly 5 get through).

```bash
BASE_URL=http://localhost:3000 API_KEY=<your-key> bun run check
```

It calls `/reset`, which wipes all slots and bookings, so don't point it at data you want to keep.

### Eval (development only)

`bun run eval` scores the API on 59 labeled cases in `test/fixtures/eval/`, grouped by level:

- **Requests:** one request after a reset and a few bookings, checked for the status code, the `{"error": ...}` body, and the response body or headers.
- **Flows:** multi-step cases, such as paging through 5 bookings with a cursor, or a replayed `409` staying `409` after the slot frees up.
- **Races:** 25 parallel bookings of one slot, 10 parallel cancels, 10 parallel retries with one idempotency key, and a burst of 10 attempts for one email. Each race runs five rounds, since one clean round proves little.

```bash
bun run eval                  # every level
bun run eval --level L3 --misses
```

It doesn't need a server or a database. It calls the route handlers directly, on a private Postgres that it starts itself (from `embedded-postgres`, kept in `.test-results/`), and never touches `DATABASE_URL`. The first run sets that Postgres up in a few seconds; later runs take about one.

With `bun run dev`, the same results appear at `/dev/eval` (**Eval** in the nav), with a **Run eval** button, scores per level next to the previous run, and every case with what it expected and what it got. The page and the nav link don't exist in production.

## Project layout

```
app/
  (api)/            the API routes (the group name is not part of the URL)
    reset/  slots/  bookings/  bookings/[id]/
  page.tsx          slots and booking form
  booking/[id]/     confirmation and cancel
  my-bookings/      lookup with "Load more"
  actions.ts        server actions used by the page
  dev/eval/         eval scorecard (development only)
lib/
  http.ts           shared handler: API key check and JSON errors
  bookings.ts       validation, booking, cancel, listing
  idempotency.ts    Idempotency-Key handling
  rate-limit.ts     sliding-window limit per email
  slots.ts  cursor.ts  db.ts
  dev/              eval runner and its local Postgres
db/schema.sql       tables and the unique index
scripts/            db setup, demo seed, contract checks, eval
test/fixtures/eval/ the eval's labeled cases
```
