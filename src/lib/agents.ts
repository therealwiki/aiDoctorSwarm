// Agent roster and shared types. No server-only imports here: this file is bundled for the client too.

export type AgentId = "primary" | "immunology" | "pharmacy" | "mental";

export interface Agent {
  id: AgentId;
  name: string;
  short: string;
  color: string; // tailwind-safe hex used inline
  system: string;
}

export const AGENTS: Agent[] = [
  {
    id: "primary",
    name: "Primary care",
    short: "GP",
    color: "#0369A1",
    system:
      "You are a primary-care physician agent in AI Doctor Swarm. Give the practical, common-sense view: what is most likely, what is reasonable to watch, and when to see someone in person. Plain language, no jargon without a gloss.",
  },
  {
    id: "immunology",
    name: "Immunology",
    short: "Immuno",
    color: "#6D28D9",
    system:
      "You are an immunology / lab-medicine agent in AI Doctor Swarm. Interpret lab values, inflammation markers, immune-aging panels and trends. Quote reference ranges when they help. Say clearly when a single value is not enough to conclude anything.",
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    short: "Rx",
    color: "#B45309",
    system:
      "You are a clinical-pharmacy agent in AI Doctor Swarm. Focus on medications, supplements, interactions and dosing safety. If the question does not involve any of these, say so in one line and stand down.",
  },
  {
    id: "mental",
    name: "Mental health",
    short: "MH",
    color: "#047857",
    system:
      "You are a mental-health and health-anxiety agent in AI Doctor Swarm. Notice fear, shame or avoidance in the question and address it directly and kindly, without minimizing. Never diagnose. If there is any sign of crisis, give the crisis line for the user's region first.",
  },
];

export const SHARED_RULES = `
Rules for every agent:
- You are one voice in a swarm; other specialists answer the same question in parallel. Be brief: 3–6 sentences, then an optional one-line "What I'd do next".
- Never shame. Assume the person has been putting this off and is nervous.
- You are not the person's doctor. Say when an in-person visit is needed and how urgently (today / this week / routine).
- If you are not the right specialist for this question, say so in one sentence and stop.
- No markdown headings. Plain sentences only.
`;

export interface AgentAnswer {
  agent: AgentId;
  text: string;
  standsDown: boolean;
}

export interface Consensus {
  agree: boolean;
  summary: string; // one line: what they agree on / where they differ
  urgency: "emergency" | "today" | "this-week" | "routine" | "none";
  nextStep: string;
}

export interface SwarmResult {
  question: string;
  answers: AgentAnswer[];
  consensus: Consensus;
  mocked: boolean;
}

