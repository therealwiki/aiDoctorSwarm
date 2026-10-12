// Plain-text email and SMS templates. All Willie copy comes from WILLIE_SAYS.
//
// Rules: no diagnosis or question text in a subject line; health details only behind the signed,
// expiring link; every message says who sent it and how to reach a human (hello@).

import { WILLIE_SAYS } from "./willie";

const HUMAN = "A person reads hello@aidoctorswarm.com. Reply there any time.";
const sign = (who: string) => `\n\n— ${who}\n${HUMAN}`;

export const T = {
  magicLink: (url: string) =>
    `${WILLIE_SAYS.signIn}\n\n${url}${sign("AI Doctor Swarm")}`,

  /** Sanity check. `url` is a signed link that lands on /sanity-checks already signed in. */
  sanityCheck: (url: string) =>
    `${WILLIE_SAYS.followup}\n\nReply to this email with YES, PARTLY, NO or NOT YET — or tell me what happened in a line. ` +
    `For the full form (what happened, who got it right) use this private link; it expires in 7 days:\n\n${url}${sign("Willie, coordinator")}`,

  sanityCheckSms: (url: string) => `${WILLIE_SAYS.followupShort} Details: ${url}`,

  /** Approval request from an acting agent. One-tap links carry a token; replying YES/NO also works. */
  approval: (opts: { agent: string; title: string; approveUrl: string; declineUrl: string }) =>
    `${WILLIE_SAYS.approvalEmail(opts.title)}\n\nApprove: ${opts.approveUrl}\nDecline: ${opts.declineUrl}\n\n` +
    `Details are in your Agents inbox at aidoctorswarm.com/agents; we keep them out of email.${sign(`${opts.agent} (via Willie)`)}`,

  approvalSms: (title: string) => `${WILLIE_SAYS.approvalEmail(title)} More at aidoctorswarm.com/agents`,

  /** A reply came in by email/SMS and the swarm answered. The answer is behind a signed link. */
  answerReady: (url: string) => `${WILLIE_SAYS.answered}\n\n${url}${sign("Willie, coordinator")}`,

  reminder: (title: string) => `${WILLIE_SAYS.reminder(title)}${sign("Willie, coordinator")}`,

  /** Circle digest. Items are already written for the circle (no private chat, no raw labs). */
  circleDigest: (opts: { items: string[]; url: string }) =>
    `This week in your care circle:\n\n${opts.items.map((i) => `• ${i}`).join("\n")}\n\nOpen the circle: ${opts.url}${sign("Willie, for the care circle")}`,

  thanks: () => `${WILLIE_SAYS.thanks}${sign("Willie, coordinator")}`,
} as const;
