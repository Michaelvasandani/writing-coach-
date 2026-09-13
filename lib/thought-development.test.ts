import { describe, expect, it } from "vitest";
import {
  applyArticleShapeResponse,
  beginArticleShapeExploration,
  buildArticleShapeRequest,
  buildThoughtRequest,
  canExploreArticleShapes,
  createThoughtDevelopmentSession,
  deleteSessionNote,
  editSessionNote,
  formatSessionNotesMarkdown,
  formatThoughtTranscriptMarkdown,
  finishThoughtDevelopment,
  isThoughtCheckpoint,
  moveShapeNote,
  removeShapeNote,
  renameShapeSection,
  reorderShapeSection,
  retryArticleShapeRequest,
  reviseThoughtAnswer,
  selectArticleShape,
  skipThoughtNode,
  thoughtDevelopmentReducer,
  continueAfterStructureOffer,
  redirectThoughtDevelopment,
  updateDevelopmentFocus,
  validateAndApplyThoughtResponse
} from "@/lib/thought-development";
import type { ArticleShapeResponse, ThoughtDevelopmentSession, ThoughtNodeId, ThoughtResponse } from "@/lib/types";
import { articleShapeOutputSchema, thoughtOutputSchema } from "@/lib/contracts/thought";

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
      "Great insight! What makes it important?",
      "Nice. Since parks reduce anxiety, what should readers conclude?"
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

  it("rejects a mostly extractive note that adds one invented substantive claim", () => {
    const session = pendingCentralPoint();
    expect(() => validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-invented", role: "central_point",
        text: "Parks make daily nature available to people without gardens and reduce clinical anxiety.",
        sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
      } }],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
    })).toThrow("unsupported Session Note");
    expect(session.notes).toEqual([]);
  });

  it("rejects a Coach-proposed note mislabeled as Writer-edited", () => {
    const session = pendingCentralPoint();
    expect(() => validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-forged", role: "central_point", text: "Parks make daily nature available.",
        sourceTurnIds: ["writer-1"], provenance: "writer-edited"
      } }],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
    })).toThrow("provenance");
  });

  it("rejects a note that changes meaning by dropping the Writer's negation", () => {
    const awaiting = awaitingCentralPoint();
    const session = thoughtDevelopmentReducer(awaiting, {
      type: "submit_answer", turnId: "writer-negation", text: "Parks do not reduce anxiety."
    });
    expect(() => validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-negation", targetNodeId: "central_point",
      articleBoundary: boundary,
      proposedNoteChanges: [{ kind: "upsert", note: {
        id: "note-negation", role: "central_point", text: "Parks reduce anxiety.",
        sourceTurnIds: ["writer-negation"], provenance: "coach-proposed"
      } }],
      readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that distinction matter?" }
    })).toThrow("unsupported Session Note");
  });

  it("preserves a redirected topic and requests a fresh question at the current frontier", () => {
    const session = awaitingCentralPoint();
    const redirected = redirectThoughtDevelopment(session, {
      topic: "How access differs across neighborhoods",
      focus: "both",
      turnId: "redirect-1"
    });

    expect(redirected.topic).toBe("How access differs across neighborhoods");
    expect(redirected.focus).toBe("both");
    expect(redirected.request).toEqual({ turnId: "redirect-1", targetNodeId: "central_point", status: "pending" });
    expect(buildThoughtRequest(redirected).topic).toBe("How access differs across neighborhoods");
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
        { kind: "upsert", note: { id: "note-edited", role: "central_point", text: "daily nature available to people without gardens", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" } }
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

  it("moves a fully resolved model completion into Session review", () => {
    let session = awaitingCentralPoint();
    session = {
      ...session,
      readiness: {
        central_point: "unresolved", reasoning: "addressed", support: "addressed",
        reader_relevance: "addressed", structural_placement: "addressed"
      }
    };
    session = thoughtDevelopmentReducer(session, { type: "submit_answer", turnId: "writer-1", text: "Parks make daily nature available." });
    const completed = validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: session.id, turnId: "writer-1", targetNodeId: "central_point",
      articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
      nextAction: { kind: "complete" }
    });

    expect(completed.phase).toBe("finished");
    expect(Object.values(completed.readiness)).not.toContain("unresolved");
  });

  it("offers reflection after question five and every three questions thereafter", () => {
    expect([1, 4, 5, 6, 8, 11, 12].filter(isThoughtCheckpoint)).toEqual([5, 8, 11]);
  });
});

describe("temporary Article Shapes", () => {
  function shapeReadySession(): ThoughtDevelopmentSession {
    const created = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "both", articleBoundary: boundary, requestId: "opening-1"
    });
    return {
      ...created,
      readiness: {
        central_point: "addressed", reasoning: "addressed", support: "addressed",
        reader_relevance: "unresolved", structural_placement: "unresolved"
      },
      frontier: ["reader_relevance", "structural_placement"],
      request: null,
      transcript: [
        { id: "writer-1", role: "writer", targetNodeId: "central_point", text: "Parks make daily nature available.", status: "accepted" },
        { id: "writer-2", role: "writer", targetNodeId: "reasoning", text: "Nearby access makes nature part of an ordinary day.", status: "accepted" },
        { id: "writer-3", role: "writer", targetNodeId: "support", text: "People without gardens can walk to the park.", status: "accepted" }
      ],
      notes: [
        { id: "note-central", role: "central_point", text: "Parks make daily nature available.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" },
        { id: "note-reason", role: "reasoning", text: "Nearby access makes nature part of an ordinary day.", sourceTurnIds: ["writer-2"], provenance: "writer-edited" },
        { id: "note-support", role: "support", text: "People without gardens can walk to the park.", sourceTurnIds: ["writer-3"], provenance: "coach-proposed" }
      ]
    };
  }

  const shapesResponse: ArticleShapeResponse = {
    contract: "thought-development.v1",
    kind: "shapes",
    sessionId: "session-1",
    requestId: "shape-request-1",
    articleBoundary: boundary,
    shapes: [{
      id: "shape-1",
      organizingLogic: "Move from the main point to its reason and concrete support.",
      tradeoff: "The example arrives after the reasoning.",
      sections: [
        { id: "section-1", purpose: "State the central point", noteIds: ["note-central"] },
        { id: "section-2", purpose: "Explain the reason", noteIds: ["note-reason", "note-support"] }
      ]
    }]
  };

  it("requires one central-point note and two current supporting notes before exploration is available", () => {
    const ready = shapeReadySession();
    expect(canExploreArticleShapes(ready)).toBe(true);
    expect(canExploreArticleShapes({ ...ready, notes: ready.notes.slice(0, 2) })).toBe(false);
    expect(canExploreArticleShapes({ ...ready, notes: ready.notes.filter((note) => note.role !== "central_point") })).toBe(false);
    expect(canExploreArticleShapes({ ...ready, notes: ready.notes.map((note) => note.id === "note-reason" ? { ...note, needsReview: true } : note) })).toBe(false);
  });

  it("builds an explicit structure request from the current Writer-edited note set", () => {
    const pending = beginArticleShapeExploration(shapeReadySession(), "shape-request-1");
    expect(buildArticleShapeRequest(pending)).toMatchObject({
      requestKind: "explore_structures",
      sessionId: "session-1",
      requestId: "shape-request-1",
      notes: [
        expect.objectContaining({ id: "note-central", text: "Parks make daily nature available." }),
        expect.objectContaining({ id: "note-reason", text: "Nearby access makes nature part of an ordinary day.", provenance: "writer-edited" }),
        expect.objectContaining({ id: "note-support" })
      ]
    });
  });

  it("retries a failed structure request with the same request identity", () => {
    const pending = beginArticleShapeExploration(shapeReadySession(), "shape-request-1");
    const failed = { ...pending, shapeRequest: { requestId: "shape-request-1", status: "failed" as const, error: "Coach unavailable" } };
    const retried = retryArticleShapeRequest(failed);
    expect(retried.shapeRequest).toEqual({ requestId: "shape-request-1", status: "pending" });
    expect(buildArticleShapeRequest(retried).requestId).toBe("shape-request-1");
  });

  it("turns insufficient or contradictory material into the exact unresolved area and one neutral follow-up", () => {
    const sparse = {
      ...shapeReadySession(),
      notes: shapeReadySession().notes.slice(0, 1),
      readiness: { ...shapeReadySession().readiness, reasoning: "unresolved" as const, support: "unresolved" as const },
      frontier: ["reasoning", "reader_relevance", "structural_placement"] as ThoughtNodeId[]
    };
    const pending = beginArticleShapeExploration(sparse, "shape-request-1");
    const next = applyArticleShapeResponse(pending, {
      contract: "thought-development.v1", kind: "unresolved", sessionId: "session-1", requestId: "shape-request-1",
      articleBoundary: boundary, unresolvedArea: "reasoning", question: "What reason connects the point to the support you have in mind?"
    });

    expect(next.shapeIssue).toEqual({ unresolvedArea: "reasoning", question: "What reason connects the point to the support you have in mind?" });
    expect(next.transcript.at(-1)).toMatchObject({ role: "coach", targetNodeId: "reasoning" });
    expect(next.shapes).toEqual([]);
    expect(() => applyArticleShapeResponse(pending, {
      contract: "thought-development.v1", kind: "unresolved", sessionId: "session-1", requestId: "shape-request-1",
      articleBoundary: boundary, unresolvedArea: "reasoning", question: "Great point! What reason applies and what example proves it?"
    })).toThrow("neutral question");
  });

  it("rejects a structure follow-up outside the current ready frontier atomically", () => {
    const session = shapeReadySession();
    const pending = beginArticleShapeExploration(session, "shape-request-1");

    expect(() => applyArticleShapeResponse(pending, {
      contract: "thought-development.v1", kind: "unresolved", sessionId: "session-1", requestId: "shape-request-1",
      articleBoundary: boundary, unresolvedArea: "central_point", question: "What central point still needs clarification?"
    })).toThrow("ready frontier");
    expect(pending.shapeRequest).toEqual({ requestId: "shape-request-1", status: "pending" });
    expect(pending.transcript).toEqual(session.transcript);
  });

  it("accepts a suitable structure offer and lets the Writer continue at the frontier", () => {
    const base = shapeReadySession();
    const pending: ThoughtDevelopmentSession = {
      ...base,
      request: { turnId: "writer-4", targetNodeId: "reader_relevance", status: "pending" },
      transcript: [...base.transcript, { id: "writer-4", role: "writer", targetNodeId: "reader_relevance", text: "Readers should notice who lacks private green space.", status: "pending" }]
    };
    const offered = validateAndApplyThoughtResponse(pending, {
      contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-4", targetNodeId: "reader_relevance",
      articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [], nextAction: { kind: "offer_structures" }
    });

    expect(offered.structuresOffered).toBe(true);
    expect(finishThoughtDevelopment(offered).structuresOffered).toBe(false);
    const continued = continueAfterStructureOffer(offered, "continue-1");
    expect(continued.structuresOffered).toBe(false);
    expect(continued.request).toEqual({ turnId: "continue-1", targetNodeId: "reader_relevance", status: "pending" });
  });

  it("rejects a structure offer before current notes make exploration suitable", () => {
    const base = shapeReadySession();
    const session: ThoughtDevelopmentSession = {
      ...base,
      notes: base.notes.slice(0, 1),
      request: { turnId: "writer-4", targetNodeId: "reader_relevance", status: "pending" },
      transcript: [...base.transcript, { id: "writer-4", role: "writer", targetNodeId: "reader_relevance", text: "Readers should notice who lacks private green space.", status: "pending" }]
    };
    expect(() => validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-4", targetNodeId: "reader_relevance",
      articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [], nextAction: { kind: "offer_structures" }
    })).toThrow("not suitable");
  });

  it("rejects a structure offer outside a structure-oriented Development Focus", () => {
    const base = shapeReadySession();
    const session: ThoughtDevelopmentSession = {
      ...base,
      focus: "thinking",
      request: { turnId: "writer-4", targetNodeId: "reader_relevance", status: "pending" },
      transcript: [...base.transcript, { id: "writer-4", role: "writer", targetNodeId: "reader_relevance", text: "Readers should notice who lacks private green space.", status: "pending" }]
    };
    expect(() => validateAndApplyThoughtResponse(session, {
      contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-4", targetNodeId: "reader_relevance",
      articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [], nextAction: { kind: "offer_structures" }
    })).toThrow("Development Focus");
  });

  it("rejects more than three Shapes, unknown note references, and Article-prose fields atomically", () => {
    const pending = beginArticleShapeExploration(shapeReadySession(), "shape-request-1");
    expect(() => applyArticleShapeResponse(pending, { ...shapesResponse, shapes: Array.from({ length: 4 }, (_, index) => ({ ...shapesResponse.shapes[0], id: `shape-${index}` })) })).toThrow();
    expect(() => applyArticleShapeResponse(pending, {
      ...shapesResponse,
      shapes: [{ ...shapesResponse.shapes[0], sections: [{ id: "section-1", purpose: "State the point", noteIds: ["invented-note"] }] }]
    })).toThrow("current Session Notes");
    expect(() => applyArticleShapeResponse(pending, {
      ...shapesResponse,
      shapes: [{ ...shapesResponse.shapes[0], organizingLogic: "Lead with the clinical benefit before the support." }]
    })).toThrow("unsupported Article Shape substance");
    expect(articleShapeOutputSchema.safeParse({ ...shapesResponse, articleProse: "Parks are the lungs of a city." }).success).toBe(false);
    expect(articleShapeOutputSchema.safeParse({
      ...shapesResponse,
      shapes: [{ ...shapesResponse.shapes[0], sections: [{
        ...shapesResponse.shapes[0].sections[0], heading: "Parks: The Lungs of Our City"
      }] }]
    }).success).toBe(false);
    expect(pending.shapes).toEqual([]);
  });

  it("selects and edits a grounded Shape without changing the Article boundary", () => {
    const pending = beginArticleShapeExploration(shapeReadySession(), "shape-request-1");
    let session = applyArticleShapeResponse(pending, shapesResponse);
    session = selectArticleShape(session, "shape-1");
    session = renameShapeSection(session, "shape-1", "section-1", "Frame the everyday access point");
    session = reorderShapeSection(session, "shape-1", "section-2", "up");
    session = moveShapeNote(session, "shape-1", "note-central", "section-2");
    session = removeShapeNote(session, "shape-1", "note-support");

    expect(session.selectedShapeId).toBe("shape-1");
    expect(session.shapes[0].sections.map((section) => section.id)).toEqual(["section-2", "section-1"]);
    expect(session.shapes[0].sections.find((section) => section.id === "section-1")?.purpose).toBe("Frame the everyday access point");
    expect(session.shapes[0].sections.find((section) => section.id === "section-2")?.noteIds).toEqual(["note-reason", "note-central"]);
    expect(session.articleBoundary).toEqual(boundary);
  });
});

describe("copyable Session review", () => {
  function reviewSession(): ThoughtDevelopmentSession {
    const session = createThoughtDevelopmentSession({
      id: "session-1", topic: "Why local parks matter", focus: "both", articleBoundary: boundary, requestId: "opening-1"
    });
    return {
      ...session,
      request: null,
      phase: "finished",
      readiness: {
        central_point: "addressed", reasoning: "addressed", support: "skipped",
        reader_relevance: "unresolved", structural_placement: "unresolved"
      },
      transcript: [
        { id: "coach-opening", role: "coach", targetNodeId: "central_point", text: "What central point do you want readers to understand?" },
        { id: "writer-1", role: "writer", targetNodeId: "central_point", text: "Parks make daily nature available.", status: "accepted" },
        { id: "coach-reader", role: "coach", targetNodeId: "reader_relevance", text: "What should readers carry into their daily lives?" }
      ],
      notes: [
        { id: "note-reason", role: "reasoning", text: "Nearby access makes nature part of an ordinary day.", sourceTurnIds: ["writer-1"], provenance: "writer-edited" },
        { id: "note-central", role: "central_point", text: "Parks make daily nature available.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" }
      ],
      shapes: [{
        id: "shape-1", organizingLogic: "Lead with the point, then explain the reason.", tradeoff: "Support remains open.",
        sections: [
          { id: "section-1", purpose: "State the central point", noteIds: ["note-central"] },
          { id: "section-2", purpose: "Explain the reason", noteIds: ["note-reason"] }
        ]
      }],
      selectedShapeId: "shape-1"
    };
  }

  it("formats concise Markdown by note role with the selected Shape and unresolved questions", () => {
    expect(formatSessionNotesMarkdown(reviewSession())).toBe(`# Why local parks matter

## Session Notes

### Central point

- Parks make daily nature available.

### Reasoning

- Nearby access makes nature part of an ordinary day.

## Selected Article Shape

_Lead with the point, then explain the reason._

1. **State the central point**
   - Parks make daily nature available.
2. **Explain the reason**
   - Nearby access makes nature part of an ordinary day.

Tradeoff: Support remains open.

## Unresolved Questions

- **Reader relevance:** What should readers carry into their daily lives?
- **Structural placement:** Not yet explored.`);
  });

  it("formats the transcript separately without notes or Shape content", () => {
    const markdown = formatThoughtTranscriptMarkdown(reviewSession());
    expect(markdown).toBe(`# Thought-Development Transcript

## Why local parks matter

**Coach:** What central point do you want readers to understand?

**Writer:** Parks make daily nature available.

**Coach:** What should readers carry into their daily lives?`);
    expect(markdown).not.toContain("Selected Article Shape");
    expect(markdown).not.toContain("Nearby access makes nature part of an ordinary day.");
  });
});
