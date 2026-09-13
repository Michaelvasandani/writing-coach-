import { NextResponse } from "next/server";
import { categories, type ArticleBlock } from "@/lib/types";
import { deriveOverallScore, normalizeAnchor } from "@/lib/coaching";
import { snapshotContractVersion, snapshotInstructions, snapshotOutputSchema } from "@/lib/contracts/snapshot";
import { runContract } from "@/lib/server/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const output = await runContract(snapshotOutputSchema, snapshotInstructions, { contract: snapshotContractVersion, ...body }, "SNAPSHOT_MODEL", "openai/gpt-5.6-terra");
    if (output.articleId !== body.articleId || output.revision !== body.revision) throw new Error("stale response identity");
    if (new Set(output.judgments.map((item) => item.category)).size !== categories.length) throw new Error("incomplete categories");
    const blocks = body.blocks as ArticleBlock[];
    const judgments = output.judgments.map((judgment) => ({
      ...judgment,
      anchors: judgment.anchors.map((anchor) => normalizeAnchor(blocks, anchor))
    }));
    for (const judgment of judgments) {
      if (judgment.state === "insufficient" && (judgment.score !== null || judgment.confidence !== "insufficient" || judgment.anchors.length)) throw new Error("invalid insufficient judgment");
      if (judgment.state === "scored" && (judgment.score === null || judgment.confidence === "insufficient" || !judgment.anchors.length)) throw new Error("invalid scored judgment");
      if (judgment.anchors.some((anchor) => anchor === null)) throw new Error("stale anchor");
    }
    const normalizedJudgments = judgments.map((judgment) => ({ ...judgment, anchors: judgment.anchors.filter((anchor) => anchor !== null) }));
    const overall = deriveOverallScore(normalizedJudgments.map((item) => item.score));
    return NextResponse.json({ ...output, judgments: normalizedJudgments, overall, provisional: normalizedJudgments.some((item) => item.state === "scored" && item.confidence === "low") });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Snapshot failed" }, { status: 422 });
  }
}
