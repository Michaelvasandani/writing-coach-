import type { Anchor, ArticleBlock, Suggestion, SuggestionResponse } from "@/lib/types";

export function validateAnchor(blocks: ArticleBlock[], anchor: Anchor): boolean {
  const block = blocks.find((item) => item.id === anchor.blockId);
  if (!block || anchor.from < 0 || anchor.to <= anchor.from || anchor.to > block.text.length) return false;
  return block.text.slice(anchor.from, anchor.to) === anchor.quote;
}

export function normalizeAnchor(blocks: ArticleBlock[], anchor: Anchor): Anchor | null {
  if (validateAnchor(blocks, anchor)) return anchor;
  const block = blocks.find((item) => item.id === anchor.blockId);
  if (!block) return null;
  const from = block.text.indexOf(anchor.quote);
  if (from < 0 || block.text.indexOf(anchor.quote, from + 1) >= 0) return null;
  return { ...anchor, from, to: from + anchor.quote.length };
}

export function deriveOverallScore(scores: Array<number | null>): number | null {
  const available = scores.filter((score): score is number => score !== null);
  if (available.length < 4) return null;
  const mean = available.reduce((sum, score) => sum + score, 0) / available.length;
  return Math.round(mean * 20);
}

export function isCurrentRevision(requestedRevision: number, currentRevision: number): boolean {
  return requestedRevision === currentRevision;
}

function duplicateKey(suggestion: Suggestion): string {
  return `${suggestion.category}:${suggestion.scope}:${suggestion.anchors.map((anchor) => `${anchor.blockId}:${anchor.from}:${anchor.to}`).join("|")}`;
}

export function applySuggestionResponse(
  current: Suggestion[],
  blocks: ArticleBlock[],
  response: SuggestionResponse
): Suggestion[] {
  if (response.candidates.some((candidate) => candidate.anchors.some((anchor) => !validateAnchor(blocks, anchor)))) {
    throw new Error("stale anchor");
  }

  const actions = new Map(response.dispositions.map((item) => [item.suggestionId, item.action]));
  const retained = current.filter((suggestion) => actions.get(suggestion.id) !== "retire");
  const seen = new Set(retained.map(duplicateKey));
  const candidates = response.candidates.filter((candidate) => {
    const key = duplicateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ranked = [...retained, ...candidates].sort((a, b) => {
    const impact = { high: 2, medium: 1 };
    const confidence = { high: 3, medium: 2, low: 1 };
    return impact[b.impact] - impact[a.impact] || confidence[b.confidence] - confidence[a.confidence] || b.createdAt - a.createdAt;
  });
  const passage = ranked.filter((item) => item.scope === "passage").slice(0, 5);
  const structural = ranked.filter((item) => item.scope === "structural").slice(0, 3);
  return [...passage, ...structural];
}

export function findFrontier(nodes: { id: string; prerequisites: string[]; status: "ready" | "blocked" | "answered" | "skipped"; prompt?: string; required?: boolean }[]): string[] {
  const complete = new Set(nodes.filter((node) => node.status === "answered" || node.status === "skipped").map((node) => node.id));
  return nodes
    .filter((node) => node.status !== "answered" && node.status !== "skipped")
    .filter((node) => node.prerequisites.every((id) => complete.has(id)))
    .map((node) => node.id);
}
