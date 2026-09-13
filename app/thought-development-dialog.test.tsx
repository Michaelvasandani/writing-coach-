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
});
