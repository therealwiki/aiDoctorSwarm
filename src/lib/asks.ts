// Saving an ask + Willie's plan. Shared by POST /api/ask and the inbound webhook (questions by email/SMS).
// Server-only.

import type { SwarmResult } from "./agents";
import { emailAdapter } from "./channels/email";
import { SENDERS } from "./channels/types";
import type { DB } from "./db";
import { agentLabel, insertApprovalForTask, insertAsk, insertTasks, loadPermissions, loadPrefs, logEmail } from "./store";
import { T } from "./templates";
import { planAfterAsk, WILLIE_SAYS, type Task } from "./willie";

export type AskResponse = SwarmResult & {
  askId: string;
  plan: Task[];
  /** true when the plan is persisted and Willie will actually come back; false for signed-out asks. */
  scheduled: boolean;
};

/**
 * Signed out: the ask is stored anonymously and the plan is only shown (nothing to come back to).
 * Signed in: tasks are queued, approvals created and emailed from the acting agent's address.
 */
export async function persistAsk(
  db: DB | null,
  user: { id: string; email: string } | null,
  askId: string,
  result: SwarmResult,
  base: string,
): Promise<{ plan: Task[]; scheduled: boolean }> {
  if (!db) return { plan: planAfterAsk(askId, result), scheduled: false };

  if (!user) {
    await insertAsk(db, { id: askId, userId: null, question: result.question, result });
    return { plan: planAfterAsk(askId, result), scheduled: false };
  }

  const [prefs, perms] = await Promise.all([loadPrefs(db, user.id, user.email), loadPermissions(db, user.id)]);
  const plan = planAfterAsk(askId, result, prefs, perms);
  await insertAsk(db, { id: askId, userId: user.id, question: result.question, result });
  await insertTasks(db, user.id, plan);

  for (const t of plan.filter((t) => t.status === "waiting-approval")) {
    const ap = await insertApprovalForTask(db, user.id, t);
    if (prefs.allow.email && prefs.email && ap.emailToken) {
      const subject = WILLIE_SAYS.subjects.approval;
      const from = t.owner === "records" ? SENDERS.records : SENDERS.scheduling;
      const link = (d: "approve" | "decline") => `${base}/api/approvals/email?token=${ap.emailToken}&decision=${d}`;
      try {
        const { providerId } = await emailAdapter.send({
          to: prefs.email,
          subject,
          text: T.approval({ agent: agentLabel(t.owner), title: t.title, approveUrl: link("approve"), declineUrl: link("decline") }),
          from,
          replyToken: t.id,
        });
        await logEmail(db, { to: prefs.email, from, kind: "approval", subject, providerId });
      } catch (e) {
        console.error("approval email", e); // the approval still shows in /agents
      }
    }
  }
  return { plan, scheduled: true };
}
