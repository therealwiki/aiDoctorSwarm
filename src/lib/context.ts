// Patient context — local-first.
//
// The notes live only in the patient's browser (localStorage) and travel with each question as the
// `context` string /api/ask accepts. Nothing here is stored server-side: the app DB keeps only the
// question and the agents' answers, never the notes. When verified records exist, this is where a
// vault reference would be resolved into context instead.
// Client-safe.

export interface HealthProfile {
  ageRange: string;      // "", "under 18", "18–29", … — a range, not a birthdate
  sex: string;           // free text, patient's own words
  conditions: string;    // one per line
  medications: string;   // one per line, with dose if known
  allergies: string;
  recentLabs: string;    // "CRP 4.1 mg/L (Sept)", one per line
  notes: string;         // anything else the swarm should know
  useInAsks: boolean;    // send with questions
  updatedAt?: string;
}

export const EMPTY_PROFILE: HealthProfile = {
  ageRange: "", sex: "", conditions: "", medications: "", allergies: "", recentLabs: "", notes: "", useInAsks: true,
};

export const AGE_RANGES = ["under 18", "18–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80+"];

const KEY = "ads.profile.v1";

export function loadProfile(): HealthProfile {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    return raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<HealthProfile>) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(p: HealthProfile): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function profileIsEmpty(p: HealthProfile): boolean {
  return !(p.ageRange || p.sex || p.conditions || p.medications || p.allergies || p.recentLabs || p.notes).trim();
}

/** The `context` string for /api/ask, or undefined when there is nothing to send. */
export function buildContext(p: HealthProfile): string | undefined {
  if (!p.useInAsks || profileIsEmpty(p)) return undefined;
  const lines = (label: string, v: string) => {
    const items = v.split("\n").map((s) => s.trim()).filter(Boolean);
    return items.length ? `${label}: ${items.join("; ")}` : null;
  };
  return [
    p.ageRange && `Age: ${p.ageRange}`,
    p.sex && `Sex: ${p.sex.trim()}`,
    lines("Conditions", p.conditions),
    lines("Medications and supplements", p.medications),
    lines("Allergies", p.allergies),
    lines("Recent results", p.recentLabs),
    lines("Other", p.notes),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}
