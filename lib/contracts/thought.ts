import { z } from "zod";

export const thoughtContractVersion = "thought-development.v1";
export const thoughtOutputSchema = z.object({
  contract: z.literal(thoughtContractVersion), sessionId: z.string(), turnId: z.string(), targetNodeId: z.string(),
  kind: z.enum(["question", "completion"]), question: z.string().nullable(), summary: z.string().nullable(),
  note: z.object({ text: z.string(), sourceTurnId: z.string() }).nullable()
});

export const thoughtInstructions = `You are a Thought-Development Coach. Use only substance the Writer has supplied. Ask exactly one short, neutral question targeting the supplied ready frontier node. Do not praise, lead, suggest answers, bundle questions, or write Article prose. A Writer answer may become one faithful atomic note citing that Writer turn. If ambiguous, contradictory, or unknown, ask a narrower question rather than filling the gap. Return completion only when the client says all required nodes are answered or skipped; summarize only Writer-supplied notes. Echo all identifiers exactly.`;
