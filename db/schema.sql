-- Cloudflare D1 schema (SQLite). Apply with: npx wrangler d1 execute aidoctorswarm --file=db/schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- A question + the swarm's answer. context_ref points at the user's vault, never raw PHI here.
CREATE TABLE IF NOT EXISTS asks (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  question TEXT NOT NULL,
  result_json TEXT NOT NULL,
  shared_to_circle INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id TEXT NOT NULL REFERENCES circles(id),
  member_id TEXT,                   -- users.id for humans, NULL for agents
  agent_key TEXT,                   -- 'records' | 'scheduling' | ... for agents
  email TEXT,                       -- for digest-only members without an account
  role TEXT,
  can_logs INTEGER NOT NULL DEFAULT 0,
  can_chat INTEGER NOT NULL DEFAULT 0,
  can_act TEXT NOT NULL DEFAULT 'off' CHECK (can_act IN ('off','ask','auto')),
  PRIMARY KEY (circle_id, member_id, agent_key, email)
);

CREATE TABLE IF NOT EXISTS circle_messages (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  from_user TEXT, from_agent TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','expired')),
  email_token TEXT UNIQUE,          -- one-tap approve/decline from email
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  user_id TEXT NOT NULL REFERENCES users(id),
  task_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ask' CHECK (mode IN ('off','ask','auto')),
  PRIMARY KEY (user_id, task_key)
);

CREATE TABLE IF NOT EXISTS topics (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  blurb TEXT,
  scope TEXT NOT NULL DEFAULT 'global'
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  topic_slug TEXT NOT NULL REFERENCES topics(slug),
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  fact_check TEXT NOT NULL DEFAULT 'pending' CHECK (fact_check IN ('supported','mixed','unsupported','pending')),
  fact_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outbound email log (agent → patient). Never store PHI in subject.
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  kind TEXT NOT NULL,              -- 'magic_link' | 'approval' | 'digest' | 'waitlist'
  subject TEXT NOT NULL,
  provider_id TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Willie: tasks he coordinates, channel links, and the "were we right?" outcomes.
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('schedule','records','followup','digest','reminder','handoff')),
  owner TEXT NOT NULL,              -- 'willie' | 'scheduling' | 'records' | 'swarm'
  title TEXT NOT NULL,
  detail TEXT,
  due_at TEXT NOT NULL,
  channels TEXT NOT NULL,           -- JSON array, in preference order
  approval TEXT NOT NULL DEFAULT 'ask' CHECK (approval IN ('none','ask','auto')),
  related_ask_id TEXT REFERENCES asks(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','waiting-approval','sent','done','cancelled')),
  calendar_event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tasks_due ON tasks(status, due_at);

CREATE TABLE IF NOT EXISTS channel_links (
  user_id TEXT NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','google','outlook')),
  address TEXT,                     -- email or E.164 phone
  refresh_token TEXT,               -- encrypted, calendars only
  verified_at TEXT,
  allow INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, channel)
);

CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  ask_id TEXT NOT NULL REFERENCES asks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('right','partly','wrong','unknown')),
  what_happened TEXT,
  saw_clinician INTEGER NOT NULL DEFAULT 0,
  agent_verdicts TEXT,              -- JSON {agentId: 'right'|'wrong'}
  reported_via TEXT,                -- 'app' | 'email' | 'sms'
  reported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS outcomes_ask ON outcomes(ask_id);

-- Inbound messages Willie received, for audit and for SMS task matching.
CREATE TABLE IF NOT EXISTS inbound (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  body TEXT NOT NULL,
  reply_token TEXT,
  routed_json TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
