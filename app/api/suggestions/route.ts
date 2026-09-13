import { NextResponse } from "next/server";
import { suggestionContractVersion, suggestionInstructions, suggestionOutputSchema } from "@/lib/contracts/suggestion";
import { runContract } from "@/lib/server/ai";
import { normalizeAnchor } from "@/lib/coaching";
import type { ArticleBlock } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = { contract: suggestionContractVersion, ...body };
    const output = await runContract(suggestionOutputSchema, suggestionInstructions, payload, "SUGGESTION_MODEL", "openai/gpt-5.6-luna");
    if (output.articleId !== body.articleId || output.revision !== body.revision || output.mode !== body.mode) throw new Error("stale response identity");
    const blocks = body.blocks as ArticleBlock[];
    const candidates = output.candidates.map((item) => ({
      ...item,
      anchors: item.anchors.map((anchor) => normalizeAnchor(blocks, anchor))
    }));
    if (candidates.some((item) => item.anchors.some((anchor) => anchor === null))) throw new Error("stale anchor");
    const normalizedCandidates = candidates.map((item) => ({ ...item, anchors: item.anchors.filter((anchor) => anchor !== null) }));
    if (body.mode === "changed_block" && (normalizedCandidates.length > 2 || normalizedCandidates.some((item) => item.scope !== "passage" || item.anchors.some((a) => a.blockId !== body.changedBlockId)))) throw new Error("changed-block boundary violation");
    if (body.mode === "whole_article" && normalizedCandidates.some((item) => item.scope !== "structural" || item.anchors.length < 2)) throw new Error("structural boundary violation");
    return NextResponse.json({ ...output, candidates: normalizedCandidates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suggestion analysis failed" }, { status: 422 });
  }
}
