import { z } from "zod";

export const suggestionContractVersion = "suggestion-analysis.v1";
const anchor = z.object({ blockId: z.string(), from: z.number().int().nonnegative(), to: z.number().int().positive(), quote: z.string().min(1) });
export const suggestionOutputSchema = z.object({
  contract: z.literal(suggestionContractVersion),
  articleId: z.string(),
  revision: z.number().int(),
  mode: z.enum(["changed_block", "whole_article", "reassess"]),
  dispositions: z.array(z.object({ suggestionId: z.string(), action: z.enum(["retain", "revise", "retire"]), reason: z.string() })),
  candidates: z.array(z.object({
    scope: z.enum(["passage", "structural"]),
    category: z.enum(["clarity", "structure", "concision", "correctness", "audience-fit", "voice-consistency"]),
    observation: z.string(), readerImpact: z.string(), direction: z.string(), impact: z.enum(["medium", "high"]),
    confidence: z.enum(["low", "medium", "high"]), anchors: z.array(anchor).min(1), intentQuestion: z.string().nullable()
  })).max(3)
});

export const suggestionInstructions = `You are a writing Coach. Preserve Writer ownership. Never write replacement prose or invent arguments, evidence, experiences, examples, conclusions, or facts. Return only meaningful feedback grounded in exact Article text. Every candidate must explain observation, reader impact, and a direction for the Writer's own revision. Use changed_block for zero to two passage candidates in the changed block. Use whole_article for zero to three structural candidates with at least two ordered anchors. Prefer silence to low-impact or repetitive feedback. Correctness covers internal inconsistency, meaning-changing usage, and claims that may need verification—not external fact checking. Account for every supplied active suggestion exactly once. Echo the request identity exactly.`;
