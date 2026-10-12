// Magic-link auth + signed session cookie. Server-only.
//
// Flow: POST /api/auth/magic (email) → users upsert + magic_links row → email from hello@ →
//       GET /api/auth/callback?token → consume → set `ads_session` cookie (HMAC-signed, 30 days).
// The cookie carries only the user id; everything else is looked up in D1 per request.

import { cookies } from "next/headers";
import { getDB, newId, nowIso, randomToken, type DB } from "./db";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
}

export const SESSION_COOKIE = "ads_session";
const SESSION_MS = 30 * 86_400_000;
export const MAGIC_LINK_MS = 15 * 60_000;

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Dev only. In production an unset secret disables sign-in rather than signing with a known value.
  return process.env.NODE_ENV === "production" ? null : "dev-only-session-secret";
}

const enc = new TextEncoder();
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(data: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

/** Value for the session cookie, or null when no secret is configured. */
export async function sessionCookieValue(userId: string): Promise<{ value: string; expires: Date } | null> {
  const key = secret();
  if (!key) return null;
  const exp = Date.now() + SESSION_MS;
  const body = `${userId}.${exp}`;
  return { value: `${body}.${await hmac(body, key)}`, expires: new Date(exp) };
}

export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires };
}

export async function verifySession(value: string | undefined): Promise<string | null> {
  const key = secret();
  if (!key || !value) return null;
  const [userId, exp, sig] = value.split(".");
  if (!userId || !exp || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmac(`${userId}.${exp}`, key);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? userId : null;
}

interface UserRow { id: string; email: string; display_name: string | null }
const toUser = (r: UserRow): SessionUser => ({ id: r.id, email: r.email, displayName: r.display_name });

export async function getUserById(db: DB, id: string): Promise<SessionUser | null> {
  const r = await db.prepare("SELECT id, email, display_name FROM users WHERE id = ?").bind(id).first<UserRow>();
  return r ? toUser(r) : null;
}

export async function getUserByEmail(db: DB, email: string): Promise<SessionUser | null> {
  const r = await db.prepare("SELECT id, email, display_name FROM users WHERE email = ?").bind(normalizeEmail(email)).first<UserRow>();
  return r ? toUser(r) : null;
}

/** The signed-in user for the current request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const db = await getDB();
  if (!db) return null;
  return getUserById(db, userId);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Upsert the user and mint a one-time token. */
export async function createMagicLink(db: DB, rawEmail: string, ttlMs = MAGIC_LINK_MS): Promise<{ token: string; userId: string }> {
  const email = normalizeEmail(rawEmail);
  let user = await getUserByEmail(db, email);
  if (!user) {
    const id = newId("u");
    await db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind(id, email).run();
    user = { id, email, displayName: null };
  }
  const token = randomToken(32);
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await db.prepare("INSERT INTO magic_links (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, user.id, expires).run();
  return { token, userId: user.id };
}

/** Burn a token. Returns the user when valid, unused and unexpired. */
export async function consumeMagicLink(db: DB, token: string): Promise<SessionUser | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db
    .prepare(
      "SELECT u.id, u.email, u.display_name FROM magic_links m JOIN users u ON u.id = m.user_id WHERE m.token = ? AND m.used_at IS NULL AND m.expires_at > ?",
    )
    .bind(token, nowIso())
    .first<UserRow>();
  if (!row) return null;
  const r = await db.prepare("UPDATE magic_links SET used_at = ? WHERE token = ? AND used_at IS NULL").bind(nowIso(), token).run();
  if (!r.meta.changes) return null; // raced
  return toUser(row);
}

/** Sanitise a post-sign-in redirect: same-origin paths only. */
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
