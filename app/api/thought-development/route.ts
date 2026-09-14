import { NextResponse } from "next/server";
import {
  articleShapeInstructions,
  articleShapeOutputSchema,
  articleShapeRequestSchema,
  thoughtInstructions,
  thoughtOutputSchema,
  thoughtRequestSchema
} from "@/lib/contracts/thought";
import {
  canonicalThoughtNodes,
  deriveThoughtFrontier,
  validateArticleShapeResponse,
  validateThoughtResponse
} from "@/lib/contracts/thought-validation";
import { runContract } from "@/lib/server/ai";

export async function POST(request: Request) {
  try {
    const unparsed: unknown = await request.json();
    if (typeof unparsed === "object" && unparsed && "requestKind" in unparsed) {
      const body = articleShapeRequestSchema.parse(unparsed);
      const output = await runContract(articleShapeOutputSchema, articleShapeInstructions, body, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
      validateArticleShapeResponse({
        sessionId: body.sessionId,
        requestId: body.requestId,
        articleBoundary: body.articleBoundary,
        frontier: deriveThoughtFrontier(canonicalThoughtNodes, body.readiness, body.focus),
        notes: body.notes
      }, output);
      return NextResponse.json(output);
    }
    const body = thoughtRequestSchema.parse(unparsed);
    const output = await runContract(thoughtOutputSchema, thoughtInstructions, body, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
    validateThoughtResponse({
      sessionId: body.sessionId,
      request: { turnId: body.turnId, targetNodeId: body.targetNodeId },
      articleBoundary: body.articleBoundary,
      nodes: canonicalThoughtNodes,
      readiness: body.readiness,
      frontier: deriveThoughtFrontier(canonicalThoughtNodes, body.readiness, body.focus),
      focus: body.focus,
      transcript: body.transcript,
      notes: body.notes
    }, output);
    return NextResponse.json(output);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Thought Development failed" }, { status: 422 });
  }
}
