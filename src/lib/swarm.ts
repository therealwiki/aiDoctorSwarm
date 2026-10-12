import Anthropic from "@anthropic-ai/sdk";
import { AGENTS, SHARED_RULES, type Agent, type AgentAnswer, type Consensus, type SwarmResult } from "./agents";
export type { SwarmResult, AgentAnswer, Consensus } from "./agents";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

const MODEL = process.env.SWARM_MODEL ?? "claude-sonnet-4-5";

async function askOne(c: Anthropic, agent: Agent, question: string, context?: string): Promise<AgentAnswer> {
  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: agent.system + "\n" + SHARED_RULES,
    messages: [
      {
        role: "user",
        content: context ? `Patient context (private, from their own records):\n${context}\n\nQuestion: ${question}` : question,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const standsDown = /not the right specialist|stand(?:ing)? down|outside my (?:scope|area)/i.test(text) && text.length < 300;
  return { agent: agent.id, text, standsDown };
}

async function consensusPass(c: Anthropic, question: string, answers: AgentAnswer[]): Promise<Consensus> {
  const transcript = answers
    .filter((a) => !a.standsDown)
    .map((a) => `${AGENTS.find((x) => x.id === a.agent)!.name}: ${a.text}`)
    .join("\n\n");
  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are the moderator of a swarm of medical specialist agents. Read their answers and return ONLY a JSON object: {\"agree\": boolean, \"summary\": string (one sentence, what they agree on or exactly where they differ), \"urgency\": one of \"emergency\"|\"today\"|\"this-week\"|\"routine\"|\"none\", \"nextStep\": string (one concrete next action for the patient)}. Prefer the most cautious urgency any agent stated.",
    messages: [{ role: "user", content: `Question: ${question}\n\n${transcript}` }],
  });
  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      agree: !!j.agree,
      summary: String(j.summary ?? ""),
      urgency: (j.urgency ?? "none") as Consensus["urgency"],
      nextStep: String(j.nextStep ?? ""),
    };
  } catch {
    return { agree: true, summary: "The agents broadly agree.", urgency: "none", nextStep: "" };
  }
}

export async function runSwarm(question: string, context?: string): Promise<SwarmResult> {
  const c = client();
  if (!c) return mockSwarm(question);

  const answers = await Promise.all(AGENTS.map((a) => askOne(c, a, question, context)));
  const consensus = await consensusPass(c, question, answers);
  return { question, answers, consensus, mocked: false };
}

// ---------- mock, used when ANTHROPIC_API_KEY is unset ----------
function mockSwarm(question: string): SwarmResult {
  const q = question.toLowerCase();
  const labby = /crp|lab|panel|marker|blood|level|result/.test(q);
  const scary = /lump|scared|afraid|embarrass|avoid|weeks|months/.test(q);
  return {
    question,
    mocked: true,
    answers: [
      {
        agent: "primary",
        standsDown: false,
        text: labby
          ? "A mildly raised inflammation marker on its own is common — a cold two weeks ago can do it. What matters is the trend and whether anything else is going on. If you feel well, a recheck in about four weeks is reasonable; if you have fever, night sweats or new pain, that moves it up to this week. What I'd do next: book a routine visit and bring both results."
          : scary
          ? "Two weeks is long enough that it's worth having someone feel it — most lumps like this turn out to be a swollen node or a cyst, and the ones that aren't are far easier to deal with early. This is a this-week visit, not an emergency. What I'd do next: book with your GP; you don't need to explain why you waited."
          : "Thanks for asking — here's the practical view. Most questions like this have a benign explanation, and the useful step is to look at timing, what makes it better or worse, and whether anything else has changed. If it's been going on for more than two weeks, a routine visit is the right call.",
      },
      {
        agent: "immunology",
        standsDown: !labby,
        text: labby
          ? "CRP under 1 mg/L is low-risk, 1–3 is average, above 3 is mildly elevated. One reading above 3 is not a diagnosis of anything; two or more readings trending up, without an obvious infection, is what earns a closer look. If you have an immune-aging panel, the picture is clearer when CRP is read alongside IL-6 and the lymphocyte ratios rather than alone."
          : "This isn't really a lab or immunology question, so I'll stand down and let the others answer.",
      },
      {
        agent: "pharmacy",
        standsDown: !/med|pill|dose|supplement|ibuprofen|statin|vitamin/.test(q),
        text: /med|pill|dose|supplement|ibuprofen|statin|vitamin/.test(q)
          ? "Before adjusting anything, check whether the timing of your last dose lines up with the reading — several common medications and supplements shift inflammation markers. Bring an exact list (name, dose, time of day) to the visit; photos of the bottles are fine."
          : "No medication question here, so I'm standing down.",
      },
      {
        agent: "mental",
        standsDown: !scary,
        text: scary
          ? "It took something to type this out — that's the hard part done. Fear of bad news is one of the top reasons people delay care, and the waiting usually hurts more than the answer. You don't owe anyone an explanation for the two weeks. If it helps, ask the scheduling agent to book it so you don't have to make the call yourself."
          : "Nothing here suggests you need me, so I'll stand down — but I'm around if the waiting starts to weigh on you.",
      },
    ],
    consensus: {
      agree: true,
      summary: labby
        ? "All agents agree a single mildly raised value is not alarming; recheck in ~4 weeks unless symptoms change."
        : scary
        ? "All agents agree this should be seen in person this week, and that it's very likely benign."
        : "The agents agree this is worth a routine visit if it persists.",
      urgency: scary ? "this-week" : "routine",
      nextStep: scary ? "Book a GP visit this week — or let the scheduling agent do it." : "Book a routine visit and bring your recent results.",
    },
  };
}
