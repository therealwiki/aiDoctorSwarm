// D1 queries for the core loop: ask → tasks → approvals → dispatch → inbound → outcomes.
// Server-only. Dates in these tables are ISO strings written by us (SQLite compares them as text).

import type { SwarmResult } from "./agents";
import { newId, nowIso, randomToken, type DB } from "./db";
import { DEFAULT_PERMISSIONS, DEFAULT_PREFS, type ChannelPrefs, type Outcome, type PermissionMode, type Task } from "./willie";

// ---------- asks ----------

export interface AskRow {
  id: string;
  userId: string | null;
  question: string;
  result: SwarmResult;
  createdAt: string;
}

export async function insertAsk(db: DB, a: { id: string; userId: string | null; question: string; result: SwarmResult }) {
  await db
    .prepare("INSERT INTO asks (id, user_id, question, result_json, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(a.id, a.userId, a.question, JSON.stringify(a.result), nowIso())
    .run();
}

export async function getAsk(db: DB, id: string): Promise<AskRow | null> {
  const r = await db
    .prepare("SELECT id, user_id, question, result_json, created_at FROM asks WHERE id = ?")
    .bind(id)
    .first<{ id: string; user_id: string | null; question: string; result_json: string; created_at: string }>();
  if (!r) return null;
  return { id: r.id, userId: r.user_id, question: r.question, result: JSON.parse(r.result_json), createdAt: r.created_at };
}

// ---------- tasks ----------

export interface TaskRow extends Task {
  userId: string;
}

function rowToTask(r: Record<string, unknown>): TaskRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    kind: r.kind as Task["kind"],
    owner: r.owner as Task["owner"],
    title: r.title as string,
    detail: (r.detail as string | null) ?? undefined,
    dueAt: r.due_at as string,
    channels: JSON.parse(r.channels as string),
    approval: r.approval as Task["approval"],
    relatedAskId: (r.related_ask_id as string | null) ?? undefined,
    status: r.status as Task["status"],
  };
}

export async function insertTasks(db: DB, userId: string, tasks: Task[]) {
  if (!tasks.length) return;
  const stmt = db.prepare(
    "INSERT INTO tasks (id, user_id, kind, owner, title, detail, due_at, channels, approval, related_ask_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  await db.batch(
    tasks.map((t) =>
      stmt.bind(t.id, userId, t.kind, t.owner, t.title, t.detail ?? null, t.dueAt, JSON.stringify(t.channels), t.approval, t.relatedAskId ?? null, t.status, nowIso()),
    ),
  );
}

export async function getTask(db: DB, id: string): Promise<TaskRow | null> {
  const r = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return r ? rowToTask(r) : null;
}

export async function markTask(db: DB, id: string, status: Task["status"]) {
  await db.prepare("UPDATE tasks SET status = ? WHERE id = ?").bind(status, id).run();
}

/** Tasks Willie can act on himself. schedule/records wait for their executors (calendar, records). */
export async function dueTasks(db: DB, now = nowIso(), limit = 50): Promise<TaskRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM tasks WHERE status = 'queued' AND due_at <= ? AND kind IN ('followup','reminder') ORDER BY due_at LIMIT ?")
    .bind(now, limit)
    .all<Record<string, unknown>>();
  return results.map(rowToTask);
}

/** For SMS replies, which carry no token: the newest task we last wrote to this phone about. */
export async function latestSentTaskForPhone(db: DB, phone: string): Promise<TaskRow | null> {
  const r = await db
    .prepare(
      "SELECT t.* FROM tasks t JOIN channel_links c ON c.user_id = t.user_id AND c.channel = 'sms' WHERE c.address = ? AND t.status IN ('sent','waiting-approval') ORDER BY t.created_at DESC LIMIT 1",
    )
    .bind(phone)
    .first<Record<string, unknown>>();
  return r ? rowToTask(r) : null;
}

// ---------- approvals ----------

export interface ApprovalRow {
  id: string;
  agentKey: string;
  title: string;
  detail: string | null;
  taskId: string | null;
  status: "pending" | "approved" | "declined" | "expired";
  emailToken: string | null;
  createdAt: string;
}

const AGENT_LABEL: Record<string, string> = { scheduling: "Scheduling agent", records: "Records agent", willie: "Willie", swarm: "The swarm" };
export const agentLabel = (key: string) => AGENT_LABEL[key] ?? key;

/** One approval row per task that needs a human yes. Returns the one-tap email token. */
export async function insertApprovalForTask(db: DB, userId: string, task: Task, ttlDays = 14): Promise<ApprovalRow> {
  const row: ApprovalRow = {
    id: newId("ap"),
    agentKey: task.owner,
    title: task.title,
    detail: task.detail ?? null,
    taskId: task.id,
    status: "pending",
    emailToken: randomToken(24),
    createdAt: nowIso(),
  };
  await db
    .prepare(
      "INSERT INTO approvals (id, user_id, agent_key, title, detail, payload_json, status, email_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
    )
    .bind(row.id, userId, row.agentKey, row.title, row.detail, JSON.stringify({ taskId: task.id }), row.emailToken, new Date(Date.now() + ttlDays * 86_400_000).toISOString(), row.createdAt)
    .run();
  return row;
}

function rowToApproval(r: Record<string, unknown>): ApprovalRow {
  let taskId: string | null = null;
  try { taskId = (JSON.parse((r.payload_json as string) ?? "{}") as { taskId?: string }).taskId ?? null; } catch { /* ignore */ }
  return {
    id: r.id as string,
    agentKey: r.agent_key as string,
    title: r.title as string,
    detail: (r.detail as string | null) ?? null,
    taskId,
    status: r.status as ApprovalRow["status"],
    emailToken: (r.email_token as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export async function listApprovals(db: DB, userId: string, limit = 30): Promise<ApprovalRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM approvals WHERE user_id = ? ORDER BY (status = 'pending') DESC, created_at DESC LIMIT ?")
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return results.map(rowToApproval);
}

/**
 * Record a decision and move the linked task along (approve → queued, decline → cancelled).
 * Exactly one selector: the row id scoped to a user (app), the email token (one-tap), or the task id (reply).
 */
export async function decideApproval(
  db: DB,
  sel: { id: string; userId: string } | { emailToken: string } | { taskId: string },
  decision: "approve" | "decline",
): Promise<ApprovalRow | null> {
  let r: Record<string, unknown> | null;
  if ("id" in sel) {
    r = await db.prepare("SELECT * FROM approvals WHERE id = ? AND user_id = ?").bind(sel.id, sel.userId).first();
  } else if ("emailToken" in sel) {
    r = await db.prepare("SELECT * FROM approvals WHERE email_token = ?").bind(sel.emailToken).first();
  } else {
    r = await db.prepare("SELECT * FROM approvals WHERE payload_json = ? ORDER BY created_at DESC LIMIT 1").bind(JSON.stringify({ taskId: sel.taskId })).first();
  }
  if (!r) return null;
  const ap = rowToApproval(r);
  if (ap.status !== "pending") return ap;
  const expires = r.expires_at as string | null;
  if (expires && expires < nowIso()) {
    await db.prepare("UPDATE approvals SET status = 'expired' WHERE id = ?").bind(ap.id).run();
    return { ...ap, status: "expired" };
  }
  const status = decision === "approve" ? "approved" : "declined";
  const stmts = [db.prepare("UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?").bind(status, nowIso(), ap.id)];
  if (ap.taskId) {
    stmts.push(db.prepare("UPDATE tasks SET status = ? WHERE id = ? AND status = 'waiting-approval'").bind(decision === "approve" ? "queued" : "cancelled", ap.taskId));
  }
  await db.batch(stmts);
  return { ...ap, status };
}

// ---------- permissions + channel prefs ----------

export async function loadPermissions(db: DB, userId: string): Promise<Record<string, PermissionMode>> {
  const { results } = await db.prepare("SELECT task_key, mode FROM agent_permissions WHERE user_id = ?").bind(userId).all<{ task_key: string; mode: PermissionMode }>();
  const out = { ...DEFAULT_PERMISSIONS };
  for (const r of results) out[r.task_key] = r.mode;
  return out;
}

export async function setPermission(db: DB, userId: string, taskKey: string, mode: PermissionMode) {
  await db
    .prepare("INSERT INTO agent_permissions (user_id, task_key, mode) VALUES (?, ?, ?) ON CONFLICT(user_id, task_key) DO UPDATE SET mode = excluded.mode")
    .bind(userId, taskKey, mode)
    .run();
}

export interface Contact { email: string | null; sms: string | null }

/** Where Willie may reach this patient. The account email is allowed unless they turned email off. */
export async function loadContact(db: DB, userId: string, accountEmail: string): Promise<Contact> {
  const { results } = await db
    .prepare("SELECT channel, address, allow, verified_at FROM channel_links WHERE user_id = ? AND channel IN ('email','sms')")
    .bind(userId)
    .all<{ channel: "email" | "sms"; address: string | null; allow: number; verified_at: string | null }>();
  const email = results.find((r) => r.channel === "email");
  const sms = results.find((r) => r.channel === "sms");
  return {
    email: email ? (email.allow ? email.address ?? accountEmail : null) : accountEmail,
    sms: sms && sms.allow && sms.verified_at ? sms.address : null,
  };
}

export async function loadPrefs(db: DB, userId: string, accountEmail: string): Promise<ChannelPrefs> {
  const c = await loadContact(db, userId, accountEmail);
  return {
    ...DEFAULT_PREFS,
    email: c.email ?? undefined,
    sms: c.sms ?? undefined,
    allow: { ...DEFAULT_PREFS.allow, email: !!c.email, sms: !!c.sms },
  };
}

export async function userByPhone(db: DB, phone: string): Promise<{ id: string; email: string } | null> {
  return db
    .prepare("SELECT u.id, u.email FROM channel_links c JOIN users u ON u.id = c.user_id WHERE c.channel = 'sms' AND c.address = ? AND c.verified_at IS NOT NULL")
    .bind(phone)
    .first<{ id: string; email: string }>();
}

// ---------- outcomes (the swarm's ground truth) ----------

export async function insertOutcome(db: DB, userId: string, o: Outcome, via: "app" | "email" | "sms") {
  const stmts = [
    db
      .prepare(
        "INSERT INTO outcomes (id, ask_id, user_id, verdict, what_happened, saw_clinician, agent_verdicts, reported_via, reported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(newId("oc"), o.askId, userId, o.verdict, o.whatHappened || null, o.sawClinician ? 1 : 0, o.agentVerdicts ? JSON.stringify(o.agentVerdicts) : null, via, o.reportedAt),
  ];
  if (o.verdict !== "unknown") {
    stmts.push(db.prepare("UPDATE tasks SET status = 'done' WHERE related_ask_id = ? AND kind = 'followup' AND status IN ('queued','sent')").bind(o.askId));
  }
  await db.batch(stmts);
}

export interface SanityChecks {
  due: { askId: string; question: string; askedAt: string; agents: string[] }[];
  upcoming: { askId: string; question: string; dueAt: string; channels: string[] }[];
  score: { right: number; partly: number; wrong: number };
}

export async function listSanityChecks(db: DB, userId: string, now = nowIso()): Promise<SanityChecks> {
  const { results } = await db
    .prepare(
      "SELECT t.related_ask_id AS ask_id, t.due_at, t.channels, t.status, a.question, a.result_json, a.created_at FROM tasks t JOIN asks a ON a.id = t.related_ask_id WHERE t.user_id = ? AND t.kind = 'followup' AND t.status IN ('queued','sent') ORDER BY t.due_at LIMIT 50",
    )
    .bind(userId)
    .all<{ ask_id: string; due_at: string; channels: string; status: string; question: string; result_json: string; created_at: string }>();
  const due: SanityChecks["due"] = [];
  const upcoming: SanityChecks["upcoming"] = [];
  for (const r of results) {
    if (r.status === "sent" || r.due_at <= now) {
      const res = JSON.parse(r.result_json) as SwarmResult;
      due.push({ askId: r.ask_id, question: r.question, askedAt: r.created_at, agents: res.answers.filter((a) => !a.standsDown).map((a) => a.agent) });
    } else {
      upcoming.push({ askId: r.ask_id, question: r.question, dueAt: r.due_at, channels: JSON.parse(r.channels) });
    }
  }
  const { results: counts } = await db
    .prepare("SELECT verdict, COUNT(*) AS n FROM outcomes WHERE user_id = ? GROUP BY verdict")
    .bind(userId)
    .all<{ verdict: string; n: number }>();
  const score = { right: 0, partly: 0, wrong: 0 };
  for (const c of counts) if (c.verdict in score) score[c.verdict as keyof typeof score] = c.n;
  return { due, upcoming, score };
}

// ---------- logs ----------

export async function logEmail(db: DB, e: { to: string; from: string; kind: string; subject: string; providerId?: string }) {
  await db
    .prepare("INSERT INTO emails (id, to_email, from_addr, kind, subject, provider_id, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("em"), e.to, e.from, e.kind, e.subject, e.providerId ?? null, nowIso())
    .run();
}

export async function recordInbound(db: DB, i: { channel: string; from: string; body: string; replyToken?: string; routed: unknown }) {
  await db
    .prepare("INSERT INTO inbound (id, channel, from_addr, body, reply_token, routed_json, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(newId("in"), i.channel, i.from, i.body.slice(0, 4000), i.replyToken ?? null, JSON.stringify(i.routed), nowIso())
    .run();
}
