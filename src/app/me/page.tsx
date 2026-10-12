import Link from "next/link";

export default function MePage() {
  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold m-0">My health</h1>
      <p className="m-0 text-ink-soft">Connect records, labs, wearables and genetics so the swarm answers from your data instead of the average patient. Everything is encrypted and verified in three steps: identity match, lab attestation, hash anchoring.</p>
      <div className="card p-5 flex flex-col gap-3">
        {["Lab results (PDF or FHIR)", "Clinic records", "Wearable export", "Genetic sequence (VCF / 23andMe)"].map((s) => (
          <div key={s} className="flex items-center justify-between gap-3 text-sm">
            <span>{s}</span>
            <Link href="/signin" className="btn-ghost text-xs no-underline">Connect</Link>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-soft m-0">Nothing here trains a model. See <Link href="/privacy">privacy</Link>.</p>
    </div>
  );
}
