import { describe, expect, it } from "vitest";
import {
  applySuggestionResponse,
  deriveOverallScore,
  isCurrentRevision,
  normalizeAnchor,
  validateAnchor
} from "@/lib/coaching";
import type { ArticleBlock, Suggestion } from "@/lib/types";

const blocks: ArticleBlock[] = [
  { id: "p-1", type: "paragraph", text: "The train was late, so I missed the opening." },
  { id: "p-2", type: "paragraph", text: "That delay changed how I understood the trip." }
];

describe("hybrid anchors", () => {
  it("accepts an exact quote at the stated block-local offsets", () => {
    expect(validateAnchor(blocks, { blockId: "p-1", from: 4, to: 9, quote: "train" })).toBe(true);
  });

  it("rejects stale or invented evidence", () => {
    expect(validateAnchor(blocks, { blockId: "p-1", from: 4, to: 9, quote: "plane" })).toBe(false);
  });

  it("repairs wrong offsets when the exact quote appears once", () => {
    expect(normalizeAnchor(blocks, { blockId: "p-1", from: 0, to: 5, quote: "train" })).toEqual({
      blockId: "p-1", from: 4, to: 9, quote: "train"
    });
  });

  it("does not guess when the exact quote is ambiguous", () => {
    const repeated = [{ id: "p-1", type: "paragraph", text: "late, then late" }];
    expect(normalizeAnchor(repeated, { blockId: "p-1", from: 1, to: 5, quote: "late" })).toBeNull();
  });
});

describe("draft snapshot scoring", () => {
  it("rejects a response when the Article changed while it was in flight", () => {
    expect(isCurrentRevision(4, 5)).toBe(false);
  });

  it("withholds an overall score until four categories are assessable", () => {
    expect(deriveOverallScore([5, 4, 3, null, null, null])).toBeNull();
  });

  it("maps the mean five-point category score to 0–100", () => {
    expect(deriveOverallScore([5, 4, 3, 2, null, null])).toBe(70);
  });
});

describe("suggestion application", () => {
  const existing: Suggestion[] = [{
    id: "s-1", scope: "passage", category: "clarity", observation: "The cause arrives late.",
    readerImpact: "The connection may be missed.", direction: "Signal the causal link earlier.",
    impact: "high", confidence: "high", anchors: [{ blockId: "p-1", from: 0, to: 3, quote: "The" }],
    status: "active", createdAt: 1
  }];

  it("applies lifecycle dispositions and suppresses duplicate candidates", () => {
    const result = applySuggestionResponse(existing, blocks, {
      dispositions: [{ suggestionId: "s-1", action: "retain" }],
      candidates: [{ ...existing[0], id: "candidate", createdAt: 2 }]
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s-1");
  });

  it("rejects the whole response when one anchor is stale", () => {
    expect(() => applySuggestionResponse([], blocks, {
      dispositions: [],
      candidates: [{ ...existing[0], id: "bad", anchors: [{ blockId: "p-1", from: 0, to: 5, quote: "Wrong" }] }]
    })).toThrow("stale anchor");
  });
});
