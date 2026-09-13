import { describe, expect, it } from "vitest";
import {
  buildThoughtRequest,
  createThoughtDevelopmentSession,
  deleteSessionNote,
  editSessionNote,
  finishThoughtDevelopment,
  isThoughtCheckpoint,
  reviseThoughtAnswer,
  skipThoughtNode,
  thoughtDevelopmentReducer,
  updateDevelopmentFocus,
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

describe("Session Notes and Development Readiness", () => {
  function awaitingCentralPoint() {
    const created = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "thinking", articleBoundary: boundary, requestId: "opening-1"
    });
    return validateAndApplyThoughtResponse(created, openingResponse(created.id, "opening-1"));
  }

  function pendingCentralPoint() {
    return thoughtDevelopmentReducer(awaitingCentralPoint(), {
      type: "submit_answer", turnId: "writer-1", text: "Parks make daily nature available to people without gardens."
    });
  }

  it("accepts zero or more source-linked notes and rejects unsupported substance atomically", () => {
    const session = pendingCentralPoint();
    const supported: ThoughtResponse = {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-1", role: "central_point", text: "Parks make daily nature available to people without gardens.",
        sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
      } }],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
    };

    const applied = validateAndApplyThoughtResponse(session, supported);
    expect(applied.notes).toEqual([expect.objectContaining({ id: "note-1", sourceTurnIds: ["writer-1"] })]);

    expect(() => validateAndApplyThoughtResponse(session, {
      ...supported,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-unsupported", role: "central_point", text: "Public parks reduce clinical anxiety for every resident.",
        sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
      } }]
    })).toThrow("unsupported Session Note");
    expect(session.notes).toEqual([]);
    expect(session.readiness.central_point).toBe("unresolved");
  });

  it("makes Writer note edits authoritative and allows deletion", () => {
    const session = validateAndApplyThoughtResponse(pendingCentralPoint(), {
      contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-1", role: "central_point", text: "Parks make daily nature available.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
      } }],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
    });

    const edited = editSessionNote(session, "note-1", "Parks make nearby nature available.");
    expect(edited.notes[0]).toMatchObject({ text: "Parks make nearby nature available.", provenance: "writer-edited", needsReview: false });
    const waiting = thoughtDevelopmentReducer(edited, { type: "submit_answer", turnId: "writer-2", text: "It makes access practical." });
    expect(buildThoughtRequest(waiting).notes[0].text).toBe("Parks make nearby nature available.");
    expect(deleteSessionNote(edited, "note-1").notes).toEqual([]);
  });

  it("skips the active gap, exposes it in readiness, and requests the next frontier question", () => {
    const skipped = skipThoughtNode(awaitingCentralPoint(), "skip-1");
    expect(skipped.readiness.central_point).toBe("skipped");
    expect(skipped.frontier).toEqual(["reasoning", "reader_relevance", "structural_placement"]);
    expect(skipped.request).toMatchObject({ turnId: "skip-1", targetNodeId: "reasoning", status: "pending" });
  });

  it("revising an answer invalidates dependent proposed material but flags Writer-edited notes for review", () => {
    let session = validateAndApplyThoughtResponse(pendingCentralPoint(), {
      contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [
        { kind: "upsert", note: { id: "note-proposed", role: "central_point", text: "Parks make daily nature available.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" } },
        { kind: "upsert", note: { id: "note-edited", role: "central_point", text: "People without gardens get daily nature through parks.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" } }
      ],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
    });
    session = editSessionNote(session, "note-edited", "Nearby parks make nature practical for people without gardens.");

    const revised = reviseThoughtAnswer(session, "writer-1", "Parks make contact with nature part of an ordinary day.");
    expect(revised.transcript.filter((turn) => turn.role === "writer")).toEqual([
      expect.objectContaining({ id: "writer-1", text: "Parks make contact with nature part of an ordinary day.", status: "pending" })
    ]);
    expect(revised.notes).toEqual([
      expect.objectContaining({ id: "note-edited", provenance: "writer-edited", needsReview: true })
    ]);
    expect(revised.readiness.central_point).toBe("unresolved");
    expect(revised.request).toMatchObject({ turnId: "writer-1", targetNodeId: "central_point", status: "pending" });
  });

  it("changes focus and finishes without discarding partial notes", () => {
    const session = awaitingCentralPoint();
    const changed = updateDevelopmentFocus(session, "structure");
    expect(changed.focus).toBe("structure");
    expect(changed.notes).toBe(session.notes);

    const finished = finishThoughtDevelopment(changed);
    expect(finished.phase).toBe("finished");
    expect(finished.notes).toBe(changed.notes);
  });

  it("offers reflection after question five and every three questions thereafter", () => {
    expect([1, 4, 5, 6, 8, 11, 12].filter(isThoughtCheckpoint)).toEqual([5, 8, 11]);
  });
});
