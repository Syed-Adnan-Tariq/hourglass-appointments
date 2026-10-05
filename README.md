# Hourglass: appointment booking with an AI assistant

A small SaaS-style app where signed-in users book appointments either by chatting with an assistant or with a form. The assistant (Mistral) turns messages into structured booking details; the backend decides whether those details can actually be booked.

- **Frontend:** React + Vite + TypeScript
- **Backend:** NestJS (Node, TypeScript), REST, JWT auth
- **Database:** PostgreSQL (schema in `db/schema.sql`)
- **AI:** Mistral chat completions (JSON mode)

## High-level architecture

```
 React SPA ──REST/JSON──▶ NestJS API
                           ├─ AuthModule          signup/login, JWT guard
                           ├─ AppointmentsModule  booking rules + CRUD + availability
                           ├─ ChatModule          one conversation turn: orchestrates AI + booking
                           └─ AiModule            Mistral adapter, output validation, interaction logs
                                    │
                                    ▼
                               PostgreSQL  (businesses, users, appointments, chat_sessions, ai_interaction_logs)
```

**The key boundary:** `AiService` only converses and extracts. It has no database access and never books anything. `ChatService` takes its output, merges it into the session's state, and calls `AppointmentsService`, the same code path the form uses. So the AI cannot bypass business hours, the 30-minute grid or double-booking checks.

### A chat turn

1. Load (or create) the `chat_sessions` row and append the user message.
2. `AiService.extractBooking` sends the last 12 turns plus the details collected so far, and asks for JSON: `{reply, fields, confirmed}`.
3. The output is treated as untrusted: only known services, `YYYY-MM-DD` dates and `HH:mm` times survive parsing.
4. Fields are merged into session state. Once service, date and time are all known, the slot is checked immediately, so the user hears "already booked" *before* confirming.
5. The booking is only created when the model reports the user confirmed **and** nothing changed in that same turn.
6. The turn, the state and the full AI request/response (with latency and errors) are persisted.

### Fallback to the structured form

The API returns `requiresForm: true` when the AI call fails (timeout, HTTP error, invalid JSON, missing key) or when three consecutive turns extract nothing. The chat then shows an "Open the booking form" button and the form is prefilled with whatever was understood.

## Run it locally

Prerequisites: Node 20+, Docker (or any PostgreSQL 14+).

```bash
# 1. Database (applies db/schema.sql and db/seed.sql on first start)
docker compose up -d

# 2. API
cd backend
cp .env.example .env        # set JWT_SECRET and MISTRAL_API_KEY (free key at console.mistral.ai)
npm install
npm run build && npm start  # or: npm run start:dev

# 3. Web (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :3000)
```

Demo account from the seed: `demo@hourglass.test` / `Password123!`. Or create your own on the sign-up screen.

Without Docker: create a database, then run `psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql`.

## API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/login` | 10 requests/min/IP |
| GET | `/api/auth/me` | JWT |
| POST | `/api/chat/messages` | `{sessionId?, message}`; 20/min/IP |
| GET | `/api/chat/sessions/current` | resume the active conversation |
| GET | `/api/appointments` | own appointments |
| POST | `/api/appointments` | `{service, date, time, notes?}` |
| PATCH | `/api/appointments/:id/cancel` | |
| GET | `/api/appointments/availability?date=` | free slots for a day |
| GET | `/api/appointments/services` | |

Errors share one shape, `{statusCode, message}`. Statuses used: 400 validation or rule violation, 401 auth, 404 not found, 409 slot taken, 429 rate limit.

## Backend cross-cutting concerns

- **Validation:** `class-validator` DTOs with `whitelist` + `forbidNonWhitelisted`.
- **Logging:** request interceptor (method, URL, status, ms) and an AI call log line per request, plus the `ai_interaction_logs` table.
- **Rate limiting:** `@nestjs/throttler`; global 100/min, tighter on auth and chat (chat costs an LLM call).
- **Errors:** global exception filter; unexpected errors are logged server-side and never leak internals.
- **Security:** bcrypt password hashing, helmet, CORS allow-list, same error for unknown email and wrong password, every query scoped by `user_id` and `business_id`.

## Database notes

See `db/schema.sql` (DDL with comments) and `db/seed.sql` (sample inserts).

- **Double-booking is prevented by the database:** a partial unique index on `(business_id, starts_at) WHERE status <> 'cancelled'`. The app checks first for good messages, and handles the unique violation (`23505`) for the race where two people book at once.
- **Indexes:** `(user_id, starts_at DESC)` for "my appointments", `(business_id, starts_at)` for day availability, a partial index on active `chat_sessions` for "resume my chat", and a partial index on failed AI calls for debugging.
- **Multi-tenancy:** `businesses` is the tenant root and every table carries `business_id`. Signup currently assigns the single `DEFAULT_BUSINESS_ID`; the schema and queries are already tenant-scoped.
- **Performance:** chat history is a `jsonb` array on the session row (one read per turn, cheap at human conversation lengths). `ai_interaction_logs` is append-only and would be the first table to partition by month at scale.

## Key decisions and tradeoffs

| Decision | Why | Tradeoff |
|---|---|---|
| NestJS instead of bare Express | Modules, DI, guards and pipes make the service boundaries explicit | More structure than a small app strictly needs |
| Request/response chat with a typing indicator, not WebSockets | Each turn is one LLM call; there is no server push to justify a socket | Not streaming tokens; replies appear whole |
| LLM extracts, code decides | Guardrails live in testable code (`booking-rules.ts` is pure functions) | Extra round trips when the model misses a field |
| Server owns date/time conversion | Clients send business-local `date` + `time`; no browser-timezone bugs | Business timezone is a fixed offset (see limitations) |
| Messages as `jsonb` on the session | Simple, atomic, one read per turn | Awkward for per-message analytics; a `chat_messages` table is the next step |
| Schema in SQL, `synchronize: false` | The DDL is the reviewable source of truth | No migration tool wired in yet |
| Plain CSS, no UI library | Small, readable, no dependency to explain | More hand-written styling |

## Assumptions

- One provider and one calendar per business; appointments are 30 minutes, Monday to Friday, 09:00 to 17:00.
- Three fixed services. Users can only see and cancel their own appointments.
- The conversation ends when a booking succeeds; "New conversation" starts another.

## Known limitations

- **Timezone:** business-local time is a fixed UTC offset (`BUSINESS_UTC_OFFSET`), so daylight-saving changes need a manual update. A real version would store an IANA zone per business and use it for conversion.
- **No refresh tokens or email verification;** the JWT lives in `localStorage` (simple, but exposed to XSS; httpOnly cookies are the hardened option).
- **Rate limiting is in-memory** and per instance; use a shared store (Redis) when running more than one instance.
- **No rescheduling,** no admin/provider view, no reminders.
- **No automated tests yet.** The booking rules are pure functions, so unit tests would be the first thing to add.
- The AI call has a 15-second timeout and no retry.

## What was verified while building

Against a real PostgreSQL 16 with the schema above, the API was exercised end to end: signup/login, duplicate email, bad credentials, DTO validation, form booking, double booking (409), weekend and off-hours rejection (400), cancel and rebook, login rate limiting (429 after 10), and the full chat flow (extract, early conflict check, confirm, book) plus the AI-failure fallback. For that run the Mistral endpoint was a local mock (`MISTRAL_API_URL`), because the build sandbox cannot reach `api.mistral.ai`. **Run one real conversation with your own Mistral key before submitting.** The frontend type-checks and builds, but I have not clicked through it in a browser.

## Deploying

- **Database:** Neon, Supabase or Render Postgres. Apply `db/schema.sql` and `db/seed.sql`; set `DB_SSL=true`.
- **API:** Render or Railway, root `backend`, build `npm install && npm run build`, start `npm start`. Set the env vars from `.env.example` and `CORS_ORIGIN` to the web URL.
- **Web:** Vercel or Netlify, root `frontend`, build `npm run build`, output `dist`. Set `VITE_API_URL` to `https://<api-host>/api`.
