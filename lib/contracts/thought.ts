import { z } from "zod";
import { thoughtNodeIds } from "@/lib/types";

export const thoughtContractVersion = "thought-development.v1";
const nodeIdSchema = z.enum(thoughtNodeIds);
const articleBoundarySchema = z.object({ articleId: z.string().min(1), revision: z.number().int().nonnegative(), contentHash: z.string().min(1) });
const sessionNoteSchema = z.object({
  id: z.string().min(1), role: nodeIdSchema, text: z.string().min(1), sourceTurnIds: z.array(z.string().min(1)).min(1),
  provenance: z.enum(["coach-proposed", "writer-edited"])
});
const articleShapeSectionSchema = z.object({
  id: z.string().min(1), purpose: z.string().trim().min(1).max(80), noteIds: z.array(z.string().min(1)).min(1)
}).strict();
const articleShapeSchema = z.object({
  id: z.string().min(1), organizingLogic: z.string().trim().min(1).max(240), tradeoff: z.string().trim().min(1).max(240),
  sections: z.array(articleShapeSectionSchema).min(1)
}).strict();

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

const articleShapeIdentitySchema = z.object({
  contract: z.literal(thoughtContractVersion), sessionId: z.string().min(1), requestId: z.string().min(1), articleBoundary: articleBoundarySchema
});

export const articleShapeOutputSchema = z.discriminatedUnion("kind", [
  articleShapeIdentitySchema.extend({ kind: z.literal("shapes"), shapes: z.array(articleShapeSchema).min(1).max(3) }).strict(),
  articleShapeIdentitySchema.extend({ kind: z.literal("unresolved"), unresolvedArea: nodeIdSchema, question: z.string().min(1) }).strict()
]);

export const thoughtInstructions = `You are a Thought-Development Coach. Use only substance the Writer supplied. Return one atomic response containing proposed Session Note changes, a Development Readiness patch, and exactly one next action. Ask exactly one short, neutral question targeting the supplied ready frontier node. Do not praise, lead, suggest answers, bundle questions, invent substance, or write Article prose. Every proposed Session Note must cite the Writer turn or turns that support it. If the Writer is ambiguous, contradictory, or asks you to invent an argument or example, ask one narrower question rather than filling the gap. Echo the contract, Session, turn, target, and immutable Article boundary exactly.`;

export const articleShapeInstructions = `You are arranging only the Writer's current Session Notes into temporary Article Shapes. Return at most three Shapes and only when the request kind is explore_structures. Each Shape must contain ordered functional section purposes, current Session Note IDs, a concise organizing logic, and a concise tradeoff. Do not invent claims, examples, evidence, headings, conclusions, or Article prose. Never quote or paraphrase new substantive content into a Shape; reference Session Notes by ID. If the notes are insufficient or contradictory, return the exact unresolved development area and one short, neutral follow-up question instead of any Shape. Echo the contract, Session, request, and immutable Article boundary exactly.`;
