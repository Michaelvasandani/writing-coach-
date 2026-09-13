// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThoughtDevelopmentDialog from "@/app/thought-development-dialog";
import type { ThoughtResponse } from "@/lib/types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const boundary = { articleId: "article-1", revision: 7, contentHash: "article-hash" };
let container: HTMLDivElement;
let root: Root;

function input(label: string) {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(name: string) {
  return [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === name) as HTMLButtonElement;
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1").mockReturnValueOnce("writer-1") });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Thought Development dialog", () => {
  it("shows contextual source material in setup without turning it into a Session Note", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What do you want readers to understand about this passage?" }
      }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog
      articleBoundary={boundary}
      initialTopic="Daily access to nature"
      source={{ kind: "passage", text: "The park puts nature within walking distance.", blockId: "p-1", from: 0, to: 50 }}
      onClose={() => {}}
    />));

    expect(document.body.textContent).toContain("Selected passage");
    expect(document.body.textContent).toContain("The park puts nature within walking distance.");
    act(() => setInputValue(input("Topic"), "How nearby parks change daily routines"));
    await act(async () => button("Begin Session").click());
    await settle();

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.topic).toBe("How nearby parks change daily routines");
    expect(request.source).toEqual({ kind: "passage", text: "The park puts nature within walking distance.", blockId: "p-1", from: 0, to: 50 });
    expect(request.notes).toEqual([]);
  });

  it("explains stale context and does not begin a corrupted Session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog
      articleBoundary={boundary}
      initialTopic="Old suggestion"
      source={{ kind: "suggestion", suggestionId: "s-old", text: "Clarify the opening." }}
      validateSource={() => "That Suggestion is no longer available. Choose a current source and try again."}
      onClose={() => {}}
    />));
    await act(async () => button("Begin Session").click());

    expect(document.querySelector('[role="alert"]')?.textContent).toContain("no longer available");
    expect(document.body.textContent).toContain("Old suggestion");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the Writer edit a topic, choose one focus, and begins with one neutral question", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const response: ThoughtResponse = {
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
      };
      return { ok: true, json: async () => response } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Rough park idea" onClose={() => {}} />));
    expect(document.body.textContent).toContain("Temporary Session");
    expect(input("Topic").value).toBe("Rough park idea");

    act(() => {
      setInputValue(input("Topic"), "Why local parks matter");
      input("Find a structure").click();
    });
    await act(async () => button("Begin Session").click());
    await settle();

    expect(document.body.textContent).toContain("What central point do you want readers to understand?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      sessionId: "session-1", turnId: "opening-1", targetNodeId: "central_point",
      topic: "Why local parks matter", focus: "structure", articleBoundary: boundary
    });
  });

  it("keeps a failed answer visible and retries without adding another Writer turn", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: "session-1", turnId: "opening-1", targetNodeId: "central_point",
        articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
      }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Coach unavailable" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: "session-1", turnId: "writer-1", targetNodeId: "central_point",
        articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
        nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that point matter?" }
      }) });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={() => {}} />));
    await act(async () => button("Begin Session").click());
    await settle();

    act(() => {
      setInputValue(input("Your answer"), "Parks make daily nature available.");
    });
    await act(async () => button("Continue").click());
    await settle();

    expect(document.body.textContent).toContain("Parks make daily nature available.");
    expect(document.body.textContent).toContain("Coach unavailable");
    await act(async () => button("Retry").click());
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const failed = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const retried = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(retried.turnId).toBe(failed.turnId);
    expect(document.body.textContent?.match(/Parks make daily nature available\./g)).toHaveLength(1);
    expect(document.body.textContent).toContain("Why does that point matter?");
  });

  it("keeps grounded notes in an editable drawer beside visible readiness", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const writerTurn = request.transcript.find((turn: { role: string }) => turn.role === "writer");
      return { ok: true, json: async () => writerTurn ? ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId, targetNodeId: "central_point",
        articleBoundary: boundary,
        proposedNoteChanges: [{ kind: "upsert", note: {
          id: "note-1", role: "central_point", text: writerTurn.text, sourceTurnIds: [writerTurn.id], provenance: "coach-proposed"
        } }],
        readinessPatch: [{ nodeId: "central_point", status: "addressed" }],
        nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
      }) : ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId, targetNodeId: "central_point",
        articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
      }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={() => {}} />));
    await act(async () => button("Begin Session").click());
    await settle();
    act(() => setInputValue(input("Your answer"), "Parks make daily nature available."));
    await act(async () => button("Continue").click());
    await settle();

    expect(document.body.textContent).toContain("Central point");
    expect(document.body.textContent).toContain("Addressed");
    await act(async () => button("Notes (1)").click());
    expect(input("Edit Central point note").value).toBe("Parks make daily nature available.");
    expect(document.body.textContent).toContain("Supported by: Parks make daily nature available.");

    act(() => setInputValue(input("Edit Central point note"), "Parks make nearby nature available."));
    await act(async () => button("Save note").click());
    expect(input("Edit Central point note").value).toBe("Parks make nearby nature available.");
    await act(async () => button("Delete note").click());
    expect(document.body.textContent).toContain("No notes collected yet.");
  });

  it("lets the Writer skip a gap and revise an earlier answer while readiness recomputes", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn()
      .mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1")
      .mockReturnValueOnce("skip-1").mockReturnValueOnce("writer-1") });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const questions: Record<string, { target: string; question: string }> = {
        "opening-1": { target: "central_point", question: "What central point do you want readers to understand?" },
        "skip-1": { target: "reasoning", question: "What reasoning do you want to examine?" },
        "writer-1": { target: "reader_relevance", question: "What should the intended reader understand?" }
      };
      const next = questions[request.turnId];
      const hasWriter = request.turnId === "writer-1";
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, proposedNoteChanges: [],
        readinessPatch: hasWriter ? [{ nodeId: "reasoning", status: "addressed" }] : [],
        nextAction: { kind: "ask_question", targetNodeId: next.target, question: next.question }
      }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={() => {}} />));
    await act(async () => button("Begin Session").click());
    await settle();
    await act(async () => button("Skip").click());
    await settle();
    expect(document.body.textContent).toContain("Skipped");
    expect(document.body.textContent).toContain("What reasoning do you want to examine?");

    act(() => setInputValue(input("Your answer"), "Access matters because a garden is not required."));
    await act(async () => button("Continue").click());
    await settle();
    await act(async () => button("Revise answer").click());
    expect(input("Revise your answer").value).toBe("Access matters because a garden is not required.");
  });

  it("can change focus or finish with partial work still visible", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
      }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={() => {}} />));
    await act(async () => button("Begin Session").click());
    await settle();

    await act(async () => button("Change focus").click());
    await act(async () => input("Do both").click());
    expect(document.body.textContent).toContain("Do both");
    await act(async () => button("Finish for now").click());
    expect(document.body.textContent).toContain("Partial thinking saved in this open Session");
    expect(document.body.textContent).toContain("Unresolved");
  });

  it("enables explicit grounded Shape exploration and exposes temporary Shape edits", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn()
      .mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1")
      .mockReturnValueOnce("writer-1").mockReturnValueOnce("writer-2")
      .mockReturnValueOnce("writer-3").mockReturnValueOnce("shape-request-1") });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      if (request.requestKind === "explore_structures") {
        return { ok: true, json: async () => ({
          contract: "thought-development.v1", kind: "shapes", sessionId: request.sessionId,
          requestId: request.requestId, articleBoundary: boundary,
          shapes: [
            {
              id: "shape-1", organizingLogic: "Lead with the point, then explain and support it.",
              tradeoff: "The concrete support arrives last.", sections: [
                { id: "shape-1-section-1", purpose: "State the central point", noteIds: ["note-central"] },
                { id: "shape-1-section-2", purpose: "Develop the support", noteIds: ["note-reason", "note-support"] }
              ]
            },
            {
              id: "shape-2", organizingLogic: "Begin with support before naming the point.",
              tradeoff: "The central point is delayed.", sections: [
                { id: "shape-2-section-1", purpose: "Present the concrete support", noteIds: ["note-support"] },
                { id: "shape-2-section-2", purpose: "Connect support to the point", noteIds: ["note-central", "note-reason"] }
              ]
            }
          ]
        }) } as Response;
      }
      const responses: Record<string, object> = {
        "opening-1": { proposedNoteChanges: [], readinessPatch: [], nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" } },
        "writer-1": {
          proposedNoteChanges: [{ kind: "upsert", note: { id: "note-central", role: "central_point", text: "Parks make daily nature available.", sourceTurnIds: ["writer-1"], provenance: "coach-proposed" } }],
          readinessPatch: [{ nodeId: "central_point", status: "addressed" }], nextAction: { kind: "ask_question", targetNodeId: "reasoning", question: "Why does that availability matter?" }
        },
        "writer-2": {
          proposedNoteChanges: [{ kind: "upsert", note: { id: "note-reason", role: "reasoning", text: "Nearby access makes nature part of an ordinary day.", sourceTurnIds: ["writer-2"], provenance: "coach-proposed" } }],
          readinessPatch: [{ nodeId: "reasoning", status: "addressed" }], nextAction: { kind: "ask_question", targetNodeId: "support", question: "What support from your experience makes that concrete?" }
        },
        "writer-3": {
          proposedNoteChanges: [{ kind: "upsert", note: { id: "note-support", role: "support", text: "People without gardens can walk to the park.", sourceTurnIds: ["writer-3"], provenance: "coach-proposed" } }],
          readinessPatch: [{ nodeId: "support", status: "addressed" }], nextAction: { kind: "ask_question", targetNodeId: "reader_relevance", question: "What should the intended reader understand?" }
        }
      };
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, ...responses[request.turnId]
      }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={() => {}} />));
    await act(async () => button("Begin Session").click());
    await settle();
    expect(button("Explore structures").disabled).toBe(true);

    for (const answer of [
      "Parks make daily nature available.",
      "Nearby access makes nature part of an ordinary day.",
      "People without gardens can walk to the park."
    ]) {
      act(() => setInputValue(input("Your answer"), answer));
      await act(async () => button("Continue").click());
      await settle();
    }

    expect(button("Explore structures").disabled).toBe(false);
    await act(async () => button("Explore structures").click());
    await settle();
    expect(document.body.textContent).toContain("Lead with the point, then explain and support it.");
    expect(document.body.textContent).toContain("The central point is delayed.");

    await act(async () => button("Select Shape 2").click());
    expect(document.body.textContent).toContain("Selected Shape");
    act(() => setInputValue(input("Rename Present the concrete support"), "Open with lived support"));
    await act(async () => button("Save purpose").click());
    expect(document.body.textContent).toContain("Open with lived support");
    await act(async () => button("Move Connect support to the point up").click());
    const sectionPurposes = [...document.querySelectorAll(".shape-section input")].map((element) => (element as HTMLInputElement).value);
    expect(sectionPurposes).toEqual(["Connect support to the point", "Open with lived support"]);
    await act(async () => button("Remove People without gardens can walk to the park.").click());
    expect(document.body.textContent).not.toContain("People without gardens can walk to the park.Remove");

    const shapeRequest = JSON.parse(String(fetchMock.mock.calls[4][1]?.body));
    expect(shapeRequest.requestKind).toBe("explore_structures");
    expect(shapeRequest.notes.map((note: { id: string }) => note.id)).toEqual(["note-central", "note-reason", "note-support"]);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).articleBoundary)).toEqual(Array(5).fill(boundary));
  });

  async function renderSessionWithOneNote(onClose = vi.fn()) {
    vi.stubGlobal("crypto", { randomUUID: vi.fn()
      .mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1").mockReturnValueOnce("writer-1") });
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const hasAnswer = request.turnId === "writer-1";
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary,
        proposedNoteChanges: hasAnswer ? [{ kind: "upsert", note: {
          id: "note-1", role: "central_point", text: "Parks make daily nature available.",
          sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
        } }] : [],
        readinessPatch: hasAnswer ? [{ nodeId: "central_point", status: "addressed" }] : [],
        nextAction: { kind: "ask_question", targetNodeId: hasAnswer ? "reasoning" : "central_point", question: hasAnswer
          ? "Why does that availability matter?"
          : "What central point do you want readers to understand?" }
      }) } as Response;
    }));
    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Why local parks matter" onClose={onClose} />));
    await act(async () => button("Begin Session").click());
    await settle();
    act(() => setInputValue(input("Your answer"), "Parks make daily nature available."));
    await act(async () => button("Continue").click());
    await settle();
    return onClose;
  }

  it("reviews partial work and copies concise notes separately from the transcript", async () => {
    const writeText = vi.fn(async (_value: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await renderSessionWithOneNote();

    await act(async () => button("Finish for now").click());
    expect(document.body.textContent).toContain("Review your Session");
    await act(async () => button("Copy notes").click());
    await act(async () => button("Copy transcript").click());

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText.mock.calls[0][0]).toContain("## Session Notes");
    expect(writeText.mock.calls[0][0]).toContain("### Central point");
    expect(writeText.mock.calls[0][0]).toContain("## Unresolved Questions");
    expect(writeText.mock.calls[0][0]).not.toContain("Thought-Development Transcript");
    expect(writeText.mock.calls[1][0]).toContain("# Thought-Development Transcript");
    expect(writeText.mock.calls[1][0]).not.toContain("## Session Notes");
  });

  it("closes an empty Session directly without a loss warning", async () => {
    const onClose = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({
        contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
        targetNodeId: request.targetNodeId, articleBoundary: boundary, proposedNoteChanges: [], readinessPatch: [],
        nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
      }) } as Response;
    }));
    await act(async () => root.render(<ThoughtDevelopmentDialog articleBoundary={boundary} initialTopic="Parks" onClose={onClose} />));
    await act(async () => button("Begin Session").click());
    await settle();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close Thought Development"]')!.click());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("Discard this temporary Session?");
  });

  it("offers Keep working and Close without copying for a non-empty Session", async () => {
    const onClose = await renderSessionWithOneNote();
    const close = () => document.querySelector<HTMLButtonElement>('[aria-label="Close Thought Development"]')!.click();

    await act(async () => close());
    expect(document.body.textContent).toContain("Discard this temporary Session?");
    await act(async () => button("Keep working").click());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Discard this temporary Session?");

    await act(async () => close());
    await act(async () => button("Close without copying").click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copies exactly once and then discards from the loss confirmation", async () => {
    const writeText = vi.fn(async (_value: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const onClose = await renderSessionWithOneNote();

    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close Thought Development"]')!.click());
    await act(async () => button("Copy and close").click());

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("## Session Notes");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
