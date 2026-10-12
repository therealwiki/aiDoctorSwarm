# AI Doctor Swarm — aidoctorswarm.com

One box. Ask a health question; several specialist AI agents answer in parallel, a moderator pass says whether they agree and how urgent it is, and the patient can hand the next step (booking, records) to an agent that asks before it acts.

**Stack:** Next.js 15 (App Router, Tailwind 4) · Anthropic Claude API · Cloudflare Workers via OpenNext · Cloudflare D1 (schema in `db/`).

## Run locally

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY, or leave blank for demo answers
npm run dev                     # http://localhost:3000
```

Without an API key the swarm returns scripted demo answers (`mockSwarm` in `src/lib/swarm.ts`) so the UI can be worked on offline.

## What's here

| Route | Status |
|---|---|
| `/` | Ask box, three example prompts. Done. |
| `/ask?q=` | Calls `POST /api/ask`; shows urgency + consensus banner, one card per agent, agents that "stand down" are listed not shown. Done. |
| `/api/ask` | Runs the 4 agents in `src/lib/agents.ts` in parallel, then a JSON consensus pass. Real with a key, mock without. |
| `/community`, `/community/[topic]` | Topic boards with swarm fact-check badges. Seed data only. |
| `/circle` | Shared thread + Logs/Chat/Act permission table. Seed data only. |
| `/agents` | Approval inbox + per-task Off/Ask/Auto permissions. Approve/decline posts to a stub. |
| `/sanity-checks` | Sanity checks — Willie asks the patient, later in time, whether the swarm was right; verdict + what happened + optional per-agent right/wrong → `POST /api/outcomes`. Seed data. |
| `/me`, `/atlas`, `/signin`, `/privacy` | Placeholders. |

## Willie, the coordinator hare

Willie (`src/lib/willie.ts`, drawn in `src/components/Willie.tsx`) is the orchestrator, not a medical agent. He:

- **plans after every answer** — `planAfterAsk()` queues a sanity check (1 day for emergency … 28 days for routine) and, if the consensus says "see someone", a scheduling task that waits for approval;
- **moves tasks across channels** — app, email, SMS, circle chat, calendar — using the patient's per-channel permissions (`ChannelPrefs`); adapters in `src/lib/channels/` (Resend, Twilio, Google Calendar; all dry-run until keys are set);
- **routes anything that comes back** — `routeInbound()` turns an email/SMS reply ("yes", "book it", "partly — it was a cyst") into an approval, an outcome report, or a new question for the swarm. One webhook for every channel: `POST /api/willie/inbound`. Email replies carry the task id in the Reply-To (`willie+<task>@mail.aidoctorswarm.com`); SMS is matched by phone number;
- **runs on a cron** — `wrangler.jsonc` triggers every 15 min to dispatch due tasks (the handler is the next thing to write: read `tasks` where `due_at <= now`, send via the first allowed channel, mark `sent`).

Outcomes are the swarm's ground truth: `outcomes` rows (verdict, what happened, saw clinician, per-agent verdicts) are the eval set for grading and retuning each agent's prompt.

## What's not wired yet (in order)

1. **Auth** — magic-link email. Needs a sending provider (Resend or Postmark) and `magic_links` in D1. `src/app/signin` posts to `/api/auth/magic`, which doesn't exist yet.
2. **Persistence** — swap `src/lib/data.ts` seeds for D1 queries. `npm run db:local` applies the schema; add the D1 binding id to `wrangler.jsonc`.
3. **Patient context** — `/api/ask` already accepts `context`; `/me` needs to produce it from connected records (no raw PHI in D1, store a vault reference).
4. **Agent email** — approvals and circle digests go out from `scheduling@` / `circle@`; `approvals.email_token` lets the patient approve from the email with one tap.
5. **Willie cron handler** — the scheduled Worker export that dispatches due `tasks` and sends sanity checks; plus Google/Outlook OAuth for `channel_links`.
6. **Streaming** — `/api/ask` returns one JSON blob; switch to a streamed response so cards fill as each agent finishes.
7. **Fact-check job** — a queue/cron that runs the swarm over new community posts and writes `fact_check` + `fact_note`.
8. **Atlas** — Cytoscape.js / WikiPathways rendering.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create aidoctorswarm         # paste the id into wrangler.jsonc
npm run db:migrate
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy                               # builds with OpenNext and deploys the Worker
```

`wrangler.jsonc` already routes `aidoctorswarm.com` and `www` as custom domains; Cloudflare adds the DNS records on first deploy since the zone is already there.

## Email on the domain

- **Inbound (free, now):** Cloudflare Email Routing → forward `hello@`, `clinics@`, `support@`, `privacy@` to a real mailbox.
- **Outbound (agents, magic links):** a transactional provider. Send from a subdomain (`mail.aidoctorswarm.com`) so agent volume never affects the root domain's reputation. Add the provider's SPF/DKIM records plus a DMARC record (`_dmarc` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@aidoctorswarm.com`).
- **Rules baked into the UI copy:** never a diagnosis in a subject line; health details behind a signed, expiring link; every reply-to reaches a human.

## Agents

Edit the roster in `src/lib/agents.ts`. Each agent has a system prompt; `SHARED_RULES` applies to all (be brief, never shame, say when to see someone in person, stand down if not relevant). Add an agent by appending to `AGENTS` , the UI picks it up.
