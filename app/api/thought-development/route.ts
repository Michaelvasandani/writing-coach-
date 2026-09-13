import { NextResponse } from "next/server";
import { thoughtContractVersion, thoughtInstructions, thoughtOutputSchema } from "@/lib/contracts/thought";
import { runContract } from "@/lib/server/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const output = await runContract(thoughtOutputSchema, thoughtInstructions, { contract: thoughtContractVersion, ...body }, "THOUGHT_MODEL", "openai/gpt-5.6-luna");
    if (output.sessionId !== body.sessionId || output.turnId !== body.turnId || output.targetNodeId !== body.targetNodeId) throw new Error("stale turn identity");
    if (output.kind === "question" && (!output.question || output.question.split("?").length - 1 > 1)) throw new Error("invalid question cadence");
    return NextResponse.json(output);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Thought Development failed" }, { status: 422 });
  }
}
