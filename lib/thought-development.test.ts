import { describe, expect, it } from "vitest";
import {
  createThoughtDevelopmentSession,
  thoughtDevelopmentReducer,
  validateAndApplyThoughtResponse
} from "@/lib/thought-development";
import type { ThoughtResponse } from "@/lib/types";
import { thoughtOutputSchema } from "@/lib/contracts/thought";

const boundary = {
  articleId: "article-1",
  revision: 4,
  contentHash: "hash-4"
};

function openingResponse(sessionId: string, requestId: string): ThoughtResponse {
  return {
    contract: "thought-development.v1",
    sessionId,
    turnId: requestId,
    targetNodeId: "central_point",
    articleBoundary: boundary,
    proposedNoteChanges: [],
    readinessPatch: [],
    nextAction: {
      kind: "ask_question",
      targetNodeId: "central_point",
      question: "What central point do you want readers to understand?"
    }
  };
}

describe("temporary Thought-Development Session", () => {
  it("creates the canonical prerequisite tree and chooses one ready frontier target", () => {
    const session = createThoughtDevelopmentSession({
      id: "session-1",
      topic: "Why local parks matter",
      focus: "thinking",
      articleBoundary: boundary,
      requestId: "opening-1"
    });

    expect(session.frontier).toEqual(["central_point"]);
    expect(session.request).toMatchObject({ turnId: "opening-1", targetNodeId: "central_point", status: "pending" });
    expect(session.readiness.central_point).toBe("unresolved");
    expect(session.nodes.find((node) => node.id === "reasoning")?.prerequisites).toEqual(["central_point"]);
  });

  it("applies a valid readiness patch and one neutral next question atomically", () => {
    let session = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "thinking", articleBoundary: boundary, requestId: "opening-1"
    });
    session = validateAndApplyThoughtResponse(session, openingResponse(session.id, "opening-1"));
    session = thoughtDevelopmentReducer(session, { type: "submit_answer", turnId: "writer-1", text: "Parks make daily nature available to people without gardens." });

    const response: ThoughtResponse = {
      contract: "thought-development.v1",
      sessionId: session.id,
      turnId: "writer-1",
      targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: {
        kind: "ask_question",
        targetNodeId: "reasoning",
        question: "Why does that availability matter to the people you have in mind?"
      }
    };

    const applied = validateAndApplyThoughtResponse(session, response);
    expect(applied.readiness.central_point).toBe("addressed");
    expect(applied.frontier).toEqual(["reasoning", "reader_relevance", "structural_placement"]);
    expect(applied.transcript.at(-1)).toMatchObject({ role: "coach", targetNodeId: "reasoning" });
    expect(applied.request).toBeNull();
  });

  it("rejects stale, bundled, leading, or praising responses without changing accepted state", () => {
    const session = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "thinking", articleBoundary: boundary, requestId: "opening-1"
    });
    const invalidQuestions = [
      "What is your point and why should readers agree?",
      "Isn't the obvious point that parks improve cities?",
      "Great insight! What makes it important?"
    ];

    for (const question of invalidQuestions) {
      expect(() => validateAndApplyThoughtResponse(session, {
        ...openingResponse(session.id, "opening-1"),
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question }
      })).toThrow();
      expect(session.transcript).toEqual([]);
      expect(session.readiness.central_point).toBe("unresolved");
    }

    expect(() => validateAndApplyThoughtResponse(session, {
      ...openingResponse(session.id, "stale-turn"),
      turnId: "stale-turn"
    })).toThrow("stale turn identity");
  });

  it("retains a failed Writer answer and retries with its stable identity", () => {
    let session = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "thinking", articleBoundary: boundary, requestId: "opening-1"
    });
    session = validateAndApplyThoughtResponse(session, openingResponse(session.id, "opening-1"));
    session = thoughtDevelopmentReducer(session, { type: "submit_answer", turnId: "writer-1", text: "Parks make daily nature available." });
    session = thoughtDevelopmentReducer(session, { type: "request_failed", message: "Coach unavailable" });

    expect(session.transcript.filter((turn) => turn.role === "writer")).toHaveLength(1);
    expect(session.request).toMatchObject({ turnId: "writer-1", status: "failed", error: "Coach unavailable" });

    session = thoughtDevelopmentReducer(session, { type: "retry_request" });
    expect(session.transcript.filter((turn) => turn.role === "writer")).toHaveLength(1);
    expect(session.request).toMatchObject({ turnId: "writer-1", status: "pending" });
  });

  it("keeps an unresolved node open when an answer needs one narrower question", () => {
    let session = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "thinking", articleBoundary: boundary, requestId: "opening-1"
    });
    session = validateAndApplyThoughtResponse(session, openingResponse(session.id, "opening-1"));
    session = thoughtDevelopmentReducer(session, { type: "submit_answer", turnId: "writer-1", text: "I am not sure yet." });

    const applied = validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
      nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What part of the topic feels most important to clarify?" }
    });

    expect(applied.readiness.central_point).toBe("unresolved");
    expect(applied.transcript.at(-1)).toMatchObject({ role: "coach", targetNodeId: "central_point" });
  });
});

describe("Thought Development response contract", () => {
  it("rejects an envelope that mixes more than one next action", () => {
    const response = openingResponse("session-1", "opening-1") as ThoughtResponse & { summary?: string };
    response.summary = "This extra completion field makes the response ambiguous.";
    expect(thoughtOutputSchema.safeParse(response).success).toBe(false);
  });
});
