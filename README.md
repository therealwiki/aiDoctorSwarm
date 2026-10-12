# AI Doctor Swarm — aidoctorswarm.com

One box. Ask a health question; several specialist AI agents answer in parallel, a moderator pass says whether they agree and how urgent it is, and the patient can hand the next step (booking, records) to an agent that asks before it acts. Willie, the coordinator hare, comes back later to sanity-check the answer against what really happened.

**Stack:** Next.js 15 (App Router, Tailwind 4) · Claude API (`@anthropic-ai/sdk`) · Cloudflare Workers via OpenNext · Cloudflare D1 (schema in `db/`) · Resend (email) · Twilio (SMS).

## Run locally

```bash
npm install
cp .env.example .env.local       # fill SESSION_SECRET / CRON_SECRET / INBOUND_SECRET (openssl rand -hex 32)
npm run db:local                 # creates the local D1 in .wrangler/state and applies db/schema.sql
npm run dev                      # http://localhost:3000
```

- Without `ANTHROPIC_API_KEY` the swarm returns scripted demo answers (`mockSwarm` in `src/lib/swarm.ts`).
- Without `RESEND_API_KEY` every email is printed to the dev server log instead of sent — including the magic link, so you can sign in locally by copying it from the terminal.
- `next.config.ts` calls `initOpenNextCloudflareForDev()`, so `getCloudflareContext()` returns the local D1 under `next dev`. Vars come from `wrangler.jsonc`; Next-side secrets from `.env.local`.

## What's here

| Route | Status |
|---|---|
| `/` | Ask box, three example prompts. Done. |
| `/ask?q=` · `/ask?id=` | Calls `POST /api/ask` (or re-opens a saved answer by id); urgency + consensus banner, one card per agent, stood-down agents listed, Willie's "I'll hop back in N days" card. Done. |
| `/api/ask` | Runs the 4 agents in `src/lib/agents.ts` in parallel, then a JSON consensus pass. Saves the ask; for signed-in users also queues Willie's tasks and emails any approval request. |
| `/signin` → `/api/auth/magic` → `/api/auth/callback` | Magic-link sign-in, HMAC-signed 30-day cookie. Done. |
| `/agents` | Approval inbox + per-task Off / Ask me / Auto permissions, from D1 when signed in (demo otherwise). Approve/decline in-app or one-tap from email. Done. |
| `/sanity-checks` | Willie's due and upcoming sanity checks from D1; `POST /api/outcomes` stores the verdict. Done. |
| `/api/willie/dispatch` | Willie's cron body (see below). Done. |
| `/api/willie/inbound` | One webhook for email (JSON) and SMS (Twilio form). Routes YES/NO, outcome verdicts and new questions. Done. |
| `/me` | Account state; record connections are placeholders. |
| `/community`, `/community/[topic]`, `/circle` | Seed data only. |
| `/atlas`, `/privacy` | Placeholders. |

## Model

`SWARM_MODEL` defaults to `claude-opus-5-5` (the current Opus) in `.env.example`, `wrangler.jsonc` and `src/lib/swarm.ts`. Set it to `claude-sonnet-5-5` for a cheaper swarm. Requests use low effort for the specialists and medium for the moderator (thinking is always on for these models and counts toward `max_tokens`), structured JSON output for the consensus pass, and server-side `fallbacks: "default"` so a legitimate health question a safety classifier declines is re-run on a fallback model instead of failing.

## Willie, the coordinator hare

Willie (`src/lib/willie.ts`, drawn in `src/components/Willie.tsx`) is the orchestrator, not a medical agent. He:

- **plans after every answer** — `planAfterAsk()` queues a sanity check (1 day for emergency … 28 days for routine) and, if the consensus says "see someone", a scheduling task. The patient's "Book and reschedule visits" permission decides whether that task is skipped (Off), waits in `/agents` and email (Ask me), or is queued directly (Auto).
- **moves tasks across channels** — app, email, SMS, circle chat, calendar — using the patient's per-channel permissions (`ChannelPrefs`, read from `channel_links`); adapters in `src/lib/channels/` (Resend, Twilio, Google Calendar; dry-run until keys are set). Each acting agent sends from its own address (`SENDERS` in `src/lib/channels/types.ts`).
- **runs on a cron** — `wrangler.jsonc` triggers every 15 min. `worker.ts` is the Worker entry: it re-exports the OpenNext handler and adds a `scheduled` export that calls `POST /api/willie/dispatch` in-process with `CRON_SECRET`. `src/lib/dispatch.ts` reads `tasks` where `status='queued' AND due_at<=now` (followups and reminders; scheduling/records tasks wait for their executors), sends over the first allowed channel, marks them `sent`. Sanity-check emails carry a 7-day signed link that lands on `/sanity-checks` already signed in — the question itself never appears in the email.
- **routes anything that comes back** — `routeInbound()` turns an email/SMS reply ("yes", "book it", "partly — it was a cyst") into an approval decision, an outcome report, or a new question for the swarm, and only acts for senders linked to an account. Email replies carry the task id in the Reply-To (`willie+<task>@mail.aidoctorswarm.com`); SMS is matched by phone number to the newest task Willie wrote about. A new question by email/SMS gets answered and the patient receives a signed link to the saved answer.

Outcomes are the swarm's ground truth: `outcomes` rows (verdict, what happened, saw clinician, per-agent verdicts) are the eval set for grading and retuning each agent's prompt. They are private to the patient; only aggregated, anonymised verdicts feed grading.

## Email

All templates are plain text in `src/lib/templates.ts`; Willie's lines live in `WILLIE_SAYS` so he sounds the same everywhere. Rules baked in: never a diagnosis or the question in a subject line; health details only behind a signed, expiring link; every message names a human address (hello@).

- **Outbound (Resend):** send from a subdomain (`mail.aidoctorswarm.com`) so agent volume never affects the root domain's reputation. Verify the domain in Resend, add its SPF/DKIM records plus DMARC (`_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@aidoctorswarm.com`). Senders: `willie@mail.` (Willie), `hello@` (sign-in), `scheduling@`, `records@`, `circle@`.
- **Inbound (replies to Willie):** route `*@mail.aidoctorswarm.com` to `POST https://aidoctorswarm.com/api/willie/inbound?key=<INBOUND_SECRET>` as JSON with `from`, `to`, `text`. Resend inbound or a Cloudflare Email Worker both work.
- **Inbound (humans):** Cloudflare Email Routing → forward `hello@`, `clinics@`, `support@`, `privacy@` to a real mailbox.
- **SMS (Twilio):** set the messaging webhook to the same inbound URL (form-encoded). Requests are signature-checked when `TWILIO_AUTH_TOKEN` is set; Willie's reply goes back as TwiML.

## What's not wired yet (in order)

1. **Patient context** — `/api/ask` already accepts `context`; `/me` needs to produce it from connected records (no raw PHI in D1, store a vault reference).
2. **Executors for scheduling/records tasks** — approved `schedule` tasks sit at `queued` until the calendar adapter has OAuth (`channel_links.refresh_token`) and a booking flow; same for `records`.
3. **Circle + community persistence** — swap the seeds in `src/lib/data.ts` for D1 (`circles`, `circle_messages`, `topics`, `posts`), then the circle digest task (template exists).
4. **SMS linking** — a `/me` flow to add and verify a phone number into `channel_links` so Willie may text.
5. **Streaming** — `/api/ask` returns one JSON blob; switch to a streamed response so cards fill as each agent finishes.
6. **Fact-check job** — a queue/cron that runs the swarm over new community posts and writes `fact_check` + `fact_note`.
7. **Atlas** — Cytoscape.js / WikiPathways rendering.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create aidoctorswarm           # paste the id into wrangler.jsonc
npm run db:migrate
for s in ANTHROPIC_API_KEY SESSION_SECRET CRON_SECRET INBOUND_SECRET RESEND_API_KEY; do npx wrangler secret put $s; done
npm run deploy                                 # builds with OpenNext and deploys worker.ts
```

`wrangler.jsonc` already routes `aidoctorswarm.com` and `www` as custom domains; Cloudflare adds the DNS records on first deploy since the zone is already there. After changing `wrangler.jsonc`, run `npm run cf-typegen` to refresh `cloudflare-env.d.ts`.

## Agents

Edit the roster in `src/lib/agents.ts`. Each agent has a system prompt; `SHARED_RULES` applies to all (be brief, never shame, say when to see someone in person, stand down if not relevant). Add an agent by appending to `AGENTS` — the UI picks it up.
