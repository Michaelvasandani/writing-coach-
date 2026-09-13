import { NextResponse } from "next/server";
import { thoughtContractVersion, thoughtInstructions, thoughtOutputSchema } from "@/lib/contracts/thought";
import { isNeutralSingleQuestion } from "@/lib/thought-development";
import { runContract } from "@/lib/server/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const output = await runContract(thoughtOutputSchema, thoughtInstructions, { contract: thoughtContractVersion, ...body }, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
    if (output.sessionId !== body.sessionId || output.turnId !== body.turnId || output.targetNodeId !== body.targetNodeId) throw new Error("stale turn identity");
    if (JSON.stringify(output.articleBoundary) !== JSON.stringify(body.articleBoundary)) throw new Error("stale Article boundary");
    if (output.nextAction.kind === "ask_question" && !isNeutralSingleQuestion(output.nextAction.question)) throw new Error("invalid question cadence");
    return NextResponse.json(output);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Thought Development failed" }, { status: 422 });
  }
}
