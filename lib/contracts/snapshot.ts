import { z } from "zod";

export const snapshotContractVersion = "draft-snapshot.v1";
const category = z.enum(["clarity", "structure", "concision", "correctness", "audience-fit", "voice-consistency"]);
const anchor = z.object({ blockId: z.string(), from: z.number().int().nonnegative(), to: z.number().int().positive(), quote: z.string().min(1) });
export const snapshotOutputSchema = z.object({
  contract: z.literal(snapshotContractVersion), articleId: z.string(), revision: z.number().int(),
  judgments: z.array(z.object({
    category, state: z.enum(["scored", "insufficient"]), score: z.number().int().min(1).max(5).nullable(),
    confidence: z.enum(["low", "medium", "high", "insufficient"]), explanation: z.string(),
    anchors: z.array(anchor), intentQuestion: z.string().nullable()
  })).length(6),
  priorities: z.array(z.object({ rank: z.number().int().min(1).max(3), category, guidance: z.string(), why: z.string() })).max(3)
});

export const snapshotInstructions = `You are assessing observed reader impact in the Writer's Article. Preserve authorship and never supply replacement prose. Return exactly one judgment for clarity, structure, concision, correctness, audience-fit, and voice-consistency. Use a 1–5 score only when the Article contains enough exact evidence; otherwise state insufficient, null score, insufficient confidence, and no anchors. Scored judgments need exact hybrid anchors. Unknown unconventional intent lowers confidence and may produce one neutral intent question, but is not itself a penalty. Priorities are at most three meaningful Writer decisions or improvement directions, never generated prose. Echo request identity exactly.`;
