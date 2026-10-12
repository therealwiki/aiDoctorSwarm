import { NextRequest, NextResponse } from "next/server";

// Placeholder: records the decision and bounces back. Wire to D1 `approvals` once auth exists.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  console.log("approval", { id, decision });
  return NextResponse.redirect(new URL(`/agents?decided=${encodeURIComponent(id)}:${decision}`, req.url), 303);
}
