"use client";

import { useEffect, useState } from "react";
import { AGE_RANGES, buildContext, clearProfile, EMPTY_PROFILE, loadProfile, profileIsEmpty, saveProfile, type HealthProfile } from "@/lib/context";

const FIELDS: { key: keyof HealthProfile; label: string; hint: string; rows?: number }[] = [
  { key: "conditions", label: "Conditions", hint: "One per line, e.g. hypothyroidism (2019)", rows: 2 },
  { key: "medications", label: "Medications and supplements", hint: "Name and dose if you know it, one per line", rows: 2 },
  { key: "allergies", label: "Allergies", hint: "Drug or food allergies", rows: 1 },
  { key: "recentLabs", label: "Recent results", hint: "e.g. CRP 4.1 mg/L (Sept), one per line", rows: 2 },
  { key: "notes", label: "Anything else", hint: "What the swarm should know about you", rows: 2 },
];

/** Health notes kept in this browser only; sent with each question when the toggle is on. */
export default function HealthNotes() {
  const [p, setP] = useState<HealthProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saved" | "failed">("idle");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    setP(loadProfile());
    setLoaded(true);
  }, []);

  function set<K extends keyof HealthProfile>(k: K, v: HealthProfile[K]) {
    setP((x) => ({ ...x, [k]: v }));
    setSaved("idle");
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(saveProfile(p) ? "saved" : "failed");
  }
  function forget() {
    clearProfile();
    setP(EMPTY_PROFILE);
    setSaved("idle");
  }

  const context = buildContext({ ...p, useInAsks: true });

  return (
    <form onSubmit={save} className="card p-5 flex flex-col gap-4" aria-busy={!loaded}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold m-0">Health notes</h2>
        <p className="m-0 text-sm text-ink-soft">
          Kept only in this browser and sent with your questions so the swarm answers about you, not the average patient. They never reach our database.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Age range
          <select value={p.ageRange} onChange={(e) => set("ageRange", e.target.value)} className="border border-line rounded-xl px-3 py-2 bg-transparent font-normal">
            <option value="">Prefer not to say</option>
            {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Sex
          <input value={p.sex} onChange={(e) => set("sex", e.target.value)} placeholder="In your own words, if relevant" className="border border-line rounded-xl px-3 py-2 bg-transparent font-normal" />
        </label>
      </div>

      {FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm font-bold">
          {f.label}
          <textarea
            value={p[f.key] as string}
            onChange={(e) => set(f.key, e.target.value as never)}
            rows={f.rows ?? 2}
            placeholder={f.hint}
            className="border border-line rounded-xl px-3 py-2 bg-transparent font-normal text-[15px] resize-y"
          />
        </label>
      ))}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.useInAsks} onChange={(e) => set("useInAsks", e.target.checked)} className="w-4 h-4" />
        Send these notes with my questions
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-sun text-sm">Save in this browser</button>
        <button type="button" onClick={() => setPreview((v) => !v)} className="btn-ghost text-sm" disabled={!context}>
          {preview ? "Hide" : "Show"} what the swarm sees
        </button>
        {!profileIsEmpty(p) && <button type="button" onClick={forget} className="btn-ghost text-sm text-red-700">Forget everything</button>}
        <span className="text-xs text-ink-soft ml-auto" role="status">
          {saved === "saved" ? "Saved on this device." : saved === "failed" ? "Couldn’t save — storage is blocked in this browser." : loaded && p.updatedAt ? `Last saved ${new Date(p.updatedAt).toLocaleDateString()}.` : ""}
        </span>
      </div>

      {preview && context && (
        <pre className="m-0 text-xs whitespace-pre-wrap bg-lavender rounded-xl p-3 text-ink">{context}</pre>
      )}
    </form>
  );
}
