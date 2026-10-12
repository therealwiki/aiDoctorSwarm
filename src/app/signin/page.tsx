import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  email: "That doesn’t look like an email address.",
  expired: "That link has expired or was already used. Ask for a new one.",
  unavailable: "Sign-in isn’t available right now. Email hello@aidoctorswarm.com if this keeps happening.",
  send: "We couldn’t send the email. Try again in a minute.",
};

export default async function SignIn({ searchParams }: { searchParams?: Promise<{ sent?: string; error?: string; next?: string }> }) {
  const sp = (await searchParams) ?? {};
  const user = await getSessionUser();

  if (user) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold m-0">You’re signed in</h1>
        <div className="card p-5 flex flex-col gap-3">
          <p className="m-0 text-sm">Signed in as <span className="font-bold">{user.email}</span>.</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/me" className="btn-sun text-sm no-underline">My health</Link>
            <form action="/api/auth/signout" method="post">
              <button className="btn-ghost text-sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold m-0">Sign in</h1>
      <p className="m-0 text-ink-soft text-sm">We’ll email you a one-time link from hello@aidoctorswarm.com. No password to remember.</p>

      {sp.sent ? (
        <div className="card p-5 flex flex-col gap-2" aria-live="polite">
          <p className="m-0 font-bold">Check your inbox</p>
          <p className="m-0 text-sm text-ink-soft">The link works once and expires in 15 minutes. Nothing about your health is in that email.</p>
        </div>
      ) : (
        <form className="card p-5 flex flex-col gap-3" action="/api/auth/magic" method="post">
          {sp.error && <p className="m-0 text-sm text-red-700" role="alert">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
          <label htmlFor="email" className="text-sm font-bold">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@email.com" className="border border-line rounded-xl px-3 py-2 bg-transparent" />
          {sp.next && <input type="hidden" name="next" value={sp.next} />}
          <button className="btn-sun" type="submit">Send me a link</button>
        </form>
      )}
      <p className="text-xs text-ink-soft m-0">Your email is used to sign you in and for Willie’s messages, if you allow them. Nothing is sold or used for training. <Link href="/privacy">Privacy</Link>.</p>
    </div>
  );
}
