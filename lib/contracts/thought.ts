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

const requestSessionNoteSchema = sessionNoteSchema.extend({ needsReview: z.boolean().optional() }).strict();
const readinessStateSchema = z.enum(["unresolved", "addressed", "skipped"]);
const readinessSchema = z.object({
  central_point: readinessStateSchema,
  reasoning: readinessStateSchema,
  support: readinessStateSchema,
  reader_relevance: readinessStateSchema,
  structural_placement: readinessStateSchema
}).strict();
const focusSchema = z.enum(["thinking", "structure", "both"]);
const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("general") }).strict(),
  z.object({ kind: z.literal("passage"), text: z.string(), blockId: z.string().optional(), from: z.number().int().nonnegative(), to: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("suggestion"), suggestionId: z.string().min(1), text: z.string() }).strict(),
  z.object({ kind: z.literal("priority"), rank: z.number().int().positive(), text: z.string() }).strict()
]);
const transcriptTurnSchema = z.discriminatedUnion("role", [
  z.object({ id: z.string().min(1), role: z.literal("writer"), targetNodeId: nodeIdSchema, text: z.string(), status: z.enum(["pending", "failed", "accepted"]) }).strict(),
  z.object({ id: z.string().min(1), role: z.literal("coach"), targetNodeId: nodeIdSchema, text: z.string() }).strict()
]);

export const thoughtRequestSchema = z.object({
  contract: z.literal(thoughtContractVersion), sessionId: z.string().min(1), turnId: z.string().min(1), targetNodeId: nodeIdSchema,
  topic: z.string().trim().min(1), focus: focusSchema, source: sourceSchema, articleBoundary: articleBoundarySchema,
  transcript: z.array(transcriptTurnSchema), notes: z.array(requestSessionNoteSchema), readiness: readinessSchema
}).strict();

export const articleShapeRequestSchema = z.object({
  contract: z.literal(thoughtContractVersion), requestKind: z.literal("explore_structures"), sessionId: z.string().min(1), requestId: z.string().min(1),
  topic: z.string().trim().min(1), focus: focusSchema, articleBoundary: articleBoundarySchema,
  notes: z.array(requestSessionNoteSchema), readiness: readinessSchema
}).strict();

export const thoughtInstructions = `You are a Thought-Development Coach. Use only substance the Writer supplied. Return one atomic response containing proposed Session Note changes, a Development Readiness patch, and exactly one next action. Ask exactly one short, neutral question targeting the supplied ready frontier node. Do not praise, lead, suggest answers, bundle questions, invent substance, or write Article prose. Every proposed Session Note must cite the Writer turn or turns that support it and use only words from those answers, in their original order; omit a note instead of paraphrasing or adding connective language. Offer structures only when the supplied current notes include a central point and at least two supporting notes; otherwise ask the next frontier question. If the Writer is ambiguous, contradictory, or asks you to invent an argument or example, ask one narrower question rather than filling the gap. Echo the contract, Session, turn, target, and immutable Article boundary exactly.`;

export const articleShapeInstructions = `You are arranging only the Writer's current Session Notes into temporary Article Shapes. Return at most three Shapes and only when the request kind is explore_structures. Each Shape must contain ordered functional section purposes, current Session Note IDs, a concise organizing logic, and a concise tradeoff. Do not invent claims, examples, evidence, headings, conclusions, or Article prose. Never quote or paraphrase new substantive content into a Shape; reference Session Notes by ID. If the notes are insufficient or contradictory, return the exact unresolved development area and one short, neutral follow-up question instead of any Shape. Echo the contract, Session, request, and immutable Article boundary exactly.`;
