import { NextResponse } from "next/server";
import {
  articleShapeInstructions,
  articleShapeOutputSchema,
  thoughtContractVersion,
  thoughtInstructions,
  thoughtOutputSchema
} from "@/lib/contracts/thought";
import { isNeutralSingleQuestion } from "@/lib/thought-development";
import { runContract } from "@/lib/server/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.requestKind === "explore_structures") {
      const output = await runContract(articleShapeOutputSchema, articleShapeInstructions, { contract: thoughtContractVersion, ...body }, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
      if (output.sessionId !== body.sessionId || output.requestId !== body.requestId) throw new Error("stale Article Shape request");
      if (JSON.stringify(output.articleBoundary) !== JSON.stringify(body.articleBoundary)) throw new Error("stale Article boundary");
      if (output.kind === "unresolved") {
        if (!isNeutralSingleQuestion(output.question)) throw new Error("invalid follow-up question");
      } else {
        const notes = Array.isArray(body.notes) ? body.notes : [];
        const currentNoteIds = new Set(notes.filter((note: { needsReview?: boolean }) => !note.needsReview).map((note: { id: string }) => note.id));
        const hasCentralPoint = notes.some((note: { role?: string; needsReview?: boolean }) => note.role === "central_point" && !note.needsReview);
        const supportingCount = notes.filter((note: { role?: string; needsReview?: boolean }) => note.role !== "central_point" && !note.needsReview).length;
        if (!hasCentralPoint || supportingCount < 2) throw new Error("current Session Notes are not sufficient for Article Shapes");
        for (const shape of output.shapes) for (const section of shape.sections) for (const noteId of section.noteIds) {
          if (!currentNoteIds.has(noteId)) throw new Error("Article Shapes must reference current Session Notes");
        }
      }
      return NextResponse.json(output);
    }
    const output = await runContract(thoughtOutputSchema, thoughtInstructions, { contract: thoughtContractVersion, ...body }, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
    if (output.sessionId !== body.sessionId || output.turnId !== body.turnId || output.targetNodeId !== body.targetNodeId) throw new Error("stale turn identity");
    if (JSON.stringify(output.articleBoundary) !== JSON.stringify(body.articleBoundary)) throw new Error("stale Article boundary");
    if (output.nextAction.kind === "ask_question" && !isNeutralSingleQuestion(output.nextAction.question)) throw new Error("invalid question cadence");
    return NextResponse.json(output);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Thought Development failed" }, { status: 422 });
  }
}
