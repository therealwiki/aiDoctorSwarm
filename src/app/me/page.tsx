import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import HealthNotes from "@/components/HealthNotes";

export default async function MePage() {
  const user = await getSessionUser();
  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold m-0">My health</h1>
      <p className="m-0 text-ink-soft">Tell the swarm about you so it answers from your situation instead of the average patient. Notes stay on your device; verified records come next.</p>

      <div className="card p-4 flex items-center justify-between gap-3 text-sm">
        {user ? (
          <>
            <span>Signed in as <span className="font-bold">{user.email}</span></span>
            <form action="/api/auth/signout" method="post"><button className="btn-ghost text-xs" type="submit">Sign out</button></form>
          </>
        ) : (
          <>
            <span>Sign in to save your questions and let Willie come back for sanity checks.</span>
            <Link href="/signin?next=/me" className="btn-sun text-xs no-underline">Sign in</Link>
          </>
        )}
      </div>

      <HealthNotes />

      <h2 className="text-lg font-extrabold m-0 mt-2">Verified records</h2>
      <p className="m-0 text-sm text-ink-soft">Connected records are verified in three steps (identity match, lab attestation, hash anchoring) and only a vault reference is ever stored here.</p>
      <div className="card p-5 flex flex-col gap-3">
        {["Lab results (PDF or FHIR)", "Clinic records", "Wearable export", "Genetic sequence (VCF / 23andMe)"].map((s) => (
          <div key={s} className="flex items-center justify-between gap-3 text-sm">
            <span>{s}</span>
            {user ? (
              <span className="pill border border-line text-ink-soft">Coming soon</span>
            ) : (
              <Link href="/signin?next=/me" className="btn-ghost text-xs no-underline">Connect</Link>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-soft m-0">Nothing here trains a model. Only a vault reference is ever stored here, never the record itself. See <Link href="/privacy">privacy</Link>.</p>
    </div>
  );
}
