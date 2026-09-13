import { z } from "zod";
import { thoughtNodeIds } from "@/lib/types";

export const thoughtContractVersion = "thought-development.v1";
const nodeIdSchema = z.enum(thoughtNodeIds);
const articleBoundarySchema = z.object({ articleId: z.string().min(1), revision: z.number().int().nonnegative(), contentHash: z.string().min(1) });
const sessionNoteSchema = z.object({
  id: z.string().min(1), role: nodeIdSchema, text: z.string().min(1), sourceTurnIds: z.array(z.string().min(1)).min(1),
  provenance: z.enum(["coach-proposed", "writer-edited"])
});

export const thoughtOutputSchema = z.object({
  contract: z.literal(thoughtContractVersion),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  targetNodeId: nodeIdSchema,
  articleBoundary: articleBoundarySchema,
  proposedNoteChanges: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("upsert"), note: sessionNoteSchema }).strict(),
    z.object({ kind: z.literal("delete"), noteId: z.string().min(1) }).strict()
  ])),
  readinessPatch: z.array(z.object({ nodeId: nodeIdSchema, status: z.enum(["addressed", "skipped"]) })),
  nextAction: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("ask_question"), targetNodeId: nodeIdSchema, question: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("offer_structures") }).strict(),
    z.object({ kind: z.literal("complete") }).strict()
  ])
}).strict();

export const thoughtInstructions = `You are a Thought-Development Coach. Use only substance the Writer supplied. Return one atomic response containing proposed Session Note changes, a Development Readiness patch, and exactly one next action. Ask exactly one short, neutral question targeting the supplied ready frontier node. Do not praise, lead, suggest answers, bundle questions, invent substance, or write Article prose. Every proposed Session Note must cite the Writer turn or turns that support it. If the Writer is ambiguous, contradictory, or asks you to invent an argument or example, ask one narrower question rather than filling the gap. Echo the contract, Session, turn, target, and immutable Article boundary exactly.`;
