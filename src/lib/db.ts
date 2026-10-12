// D1 access. Server-only (imports @opennextjs/cloudflare).
//
// Under `next dev`, initOpenNextCloudflareForDev() in next.config.ts supplies a local D1 from
// .wrangler/state (populate it with `npm run db:local`). In the deployed Worker it is the real
// binding. During a plain `next build` there is no binding at all, so callers must handle null.

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type DB = D1Database;

export async function getDB(): Promise<DB | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Random token, hex. 32 bytes = 256 bits by default. */
export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return hex(b);
}

/** Opaque id: prefix + 64 random bits. Safe inside an email local-part (willie+<id>@…). */
export function newId(prefix: string): string {
  return `${prefix}_${randomToken(8)}`;
}

export const nowIso = () => new Date().toISOString();

/** Base URL for links we put in emails/SMS. From the request when we have one, else APP_URL. */
export function appUrl(req?: Request): string {
  if (req) return new URL(req.url).origin;
  return process.env.APP_URL || "https://aidoctorswarm.com";
}
