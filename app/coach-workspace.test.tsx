// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import type { DraftSnapshot, Suggestion, ThoughtResponse } from "@/lib/types";

const editorHarness = vi.hoisted(() => {
  const content = {
    type: "doc",
    content: [
      { type: "heading", attrs: { id: "h-1", level: 1 }, content: [{ type: "text", text: "City parks" }] },
      { type: "paragraph", attrs: { id: "p-1" }, content: [{ type: "text", text: "The park puts nature within walking distance." }] }
    ]
  };
  const harness: { content: Record<string, unknown>; from: number; to: number; options: Record<string, unknown> | null; editor: unknown; editable: boolean } = {
    content, from: 1, to: 1, options: null, editor: null, editable: true
  };
  return harness;
});

vi.mock("@tiptap/react", async () => {
  const React = await import("react");
  const textOf = (node: Record<string, unknown>): string => Array.isArray(node.content)
    ? (node.content as Record<string, unknown>[]).map(textOf).join("")
    : typeof node.text === "string" ? node.text : "";
  const editor = {
    state: {
      get selection() { return { from: editorHarness.from, to: editorHarness.to, $from: { parent: { attrs: { id: "p-1" } } } }; },
      doc: {
        descendants(callback: (node: { type: { name: string }; attrs: { id?: string }; textContent: string }) => void) {
          for (const node of (editorHarness.content.content as Record<string, unknown>[] ?? [])) {
            callback({ type: { name: String(node.type) }, attrs: node.attrs as { id?: string }, textContent: textOf(node) });
          }
        },
        textBetween(from: number, to: number) {
          const passage = "The park puts nature within walking distance.";
          return passage.slice(Math.max(0, from - 1), Math.max(0, to - 1));
        }
      }
    },
    commands: {
      setContent(value: Record<string, unknown>) { editorHarness.content = value; },
      setCoachingSuggestions() {}
    },
    getJSON() { return editorHarness.content; },
    getText() { return textOf(editorHarness.content); },
    setEditable(value: boolean) { editorHarness.editable = value; }
  };
  editorHarness.editor = editor;
  return {
    EditorContent: () => React.createElement("div", { "data-testid": "article" }, editor.getText()),
    useEditor: (options: Record<string, unknown>) => { editorHarness.options = options; return editor; }
  };
});

vi.mock("@tiptap/starter-kit", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-placeholder", () => ({ default: { configure: () => ({}) } }));
vi.mock("@tiptap/extension-unique-id", () => ({ default: { configure: () => ({}) } }));
vi.mock("@/lib/editor/coaching-extension", () => ({ CoachingExtension: {} }));

import CoachWorkspace from "@/app/coach-workspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const storageKey = "margin-writing-coach.v1";
const suggestion: Suggestion = {
  id: "s-1", scope: "passage", category: "clarity", observation: "The opening hides the main point.",
  readerImpact: "Readers may not know what matters.", direction: "Clarify the central claim.", impact: "high", confidence: "high",
  anchors: [{ blockId: "p-1", from: 0, to: 8, quote: "The park" }], status: "active", createdAt: 1
};
const snapshot: DraftSnapshot = {
  revision: 7, judgments: [], priorities: [{ rank: 1, category: "structure", guidance: "Connect the park example to the central point.", why: "The relationship is not yet explicit." }],
  overall: null, provisional: true, createdAt: 1
};

let container: HTMLDivElement;
let root: Root;

function savedState(overrides: Partial<{ revision: number; suggestions: Suggestion[]; snapshot: DraftSnapshot | null }> = {}) {
  return {
    articleId: "article-1", revision: overrides.revision ?? 7, content: editorHarness.content as JSONContent,
    purpose: "Why city parks matter", audience: "City residents", context: [], suggestions: overrides.suggestions ?? [suggestion],
    snapshot: overrides.snapshot === undefined ? snapshot : overrides.snapshot
  };
}

function button(name: string) {
  return [...document.querySelectorAll("button")].find((item) => item.textContent?.trim().startsWith(name)) as HTMLButtonElement;
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

async function renderWorkspace(state = savedState()) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  await act(async () => root.render(<CoachWorkspace />));
  await settle();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  editorHarness.from = 1;
  editorHarness.to = 1;
  editorHarness.options = null;
  editorHarness.editable = true;
  localStorage.clear();
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1") });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const response: ThoughtResponse = {
      contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId, targetNodeId: request.targetNodeId,
      articleBoundary: request.articleBoundary, proposedNoteChanges: [], readinessPatch: [],
      nextAction: { kind: "ask_question", targetNodeId: "central_point", question: "What central point do you want readers to understand?" }
    };
    return { ok: true, json: async () => response } as Response;
  }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("contextual Thought Development entry", () => {
  it("keeps the persistent general entry point and leaves Article and coaching artifacts unchanged", async () => {
    await renderWorkspace();
    const before = localStorage.getItem(storageKey);
    const articleBefore = JSON.stringify(editorHarness.content);

    act(() => button("Develop your ideas").click());
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Topic"]')?.value).toBe("Why city parks matter");
    await act(async () => button("Begin Session").click());
    await settle();

    expect(JSON.stringify(editorHarness.content)).toBe(articleBefore);
    expect(localStorage.getItem(storageKey)).toBe(before);
  });

  it("launches from the current selected passage without changing it", async () => {
    await renderWorkspace();
    const before = localStorage.getItem(storageKey);
    editorHarness.from = 1;
    editorHarness.to = 46;
    act(() => (editorHarness.options?.onSelectionUpdate as (value: unknown) => void)?.({ editor: editorHarness.editor }));

    act(() => button("Develop selected passage").click());
    expect(document.body.textContent).toContain("Selected passage");
    expect(document.body.textContent).toContain("The park puts nature within walking distance.");
    await act(async () => button("Begin Session").click());
    await settle();

    const request = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(request.source).toMatchObject({ kind: "passage", text: "The park puts nature within walking distance.", blockId: "p-1", from: 1, to: 46 });
    expect(localStorage.getItem(storageKey)).toBe(before);
  });

  it("launches from an active Suggestion without changing the Suggestion", async () => {
    await renderWorkspace();
    const before = localStorage.getItem(storageKey);
    act(() => button("Suggestions").click());
    const card = document.querySelector<HTMLButtonElement>(".suggestion-card")!;
    act(() => card.click());
    act(() => button("Develop this suggestion").click());

    expect(document.body.textContent).toContain("Suggestion");
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Topic"]')?.value).toBe(suggestion.observation);
    await act(async () => button("Begin Session").click());
    await settle();

    const request = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(request.source).toMatchObject({ kind: "suggestion", suggestionId: "s-1" });
    expect(localStorage.getItem(storageKey)).toBe(before);
  });

  it("launches from a current Priority without changing the Draft Snapshot", async () => {
    await renderWorkspace();
    const before = localStorage.getItem(storageKey);
    act(() => button("Develop this priority").click());

    expect(document.body.textContent).toContain("Draft Snapshot Priority");
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Topic"]')?.value).toBe(snapshot.priorities[0].guidance);
    await act(async () => button("Begin Session").click());
    await settle();

    const request = JSON.parse(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(request.source).toMatchObject({ kind: "priority", rank: 1 });
    expect(localStorage.getItem(storageKey)).toBe(before);
  });

  it("rejects an outdated Priority before questioning begins", async () => {
    const staleSnapshot = { ...snapshot, revision: 6 };
    await renderWorkspace(savedState({ snapshot: staleSnapshot }));
    const before = localStorage.getItem(storageKey);
    act(() => button("Develop this priority").click());
    await act(async () => button("Begin Session").click());

    expect(document.querySelector('[role="alert"]')?.textContent).toContain("outdated");
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toBe(before);
  });
});

describe("temporary Session disposal and critique isolation", () => {
  it("leaves the Article unchanged, stores no Session state, and excludes it from critique after reload", async () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn()
      .mockReturnValueOnce("session-1").mockReturnValueOnce("opening-1").mockReturnValueOnce("writer-1") });
    const writeText = vi.fn(async (_value: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      if (url === "/api/thought-development") {
        const hasAnswer = request.turnId === "writer-1";
        return { ok: true, json: async () => ({
          contract: "thought-development.v1", sessionId: request.sessionId, turnId: request.turnId,
          targetNodeId: request.targetNodeId, articleBoundary: request.articleBoundary,
          proposedNoteChanges: hasAnswer ? [{ kind: "upsert", note: {
            id: "private-note", role: "central_point", text: "Parks make daily nature available.",
            sourceTurnIds: ["writer-1"], provenance: "coach-proposed"
          } }] : [],
          readinessPatch: hasAnswer ? [{ nodeId: "central_point", status: "addressed" }] : [],
          nextAction: { kind: "ask_question", targetNodeId: hasAnswer ? "reasoning" : "central_point", question: hasAnswer
            ? "Why does that availability matter?"
            : "What central point do you want readers to understand?" }
        }) } as Response;
      }
      if (url === "/api/suggestions") return { ok: true, json: async () => ({ dispositions: [], candidates: [] }) } as Response;
      return { ok: true, json: async () => ({ judgments: [], priorities: [], overall: null, provisional: true }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderWorkspace();
    const articleBefore = JSON.stringify(editorHarness.content);

    act(() => button("Develop your ideas").click());
    await act(async () => button("Begin Session").click());
    await settle();
    const answer = document.querySelector<HTMLTextAreaElement>('[aria-label="Your answer"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => { setter?.call(answer, "Parks make daily nature available."); answer.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("Continue").click());
    await settle();
    await act(async () => button("Finish for now").click());
    await act(async () => button("Copy notes").click());
    await act(async () => button("Close Session").click());
    await act(async () => button("Close without copying").click());

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(editorHarness.content)).toBe(articleBefore);
    const persisted = localStorage.getItem(storageKey)!;
    expect(persisted).not.toContain("Parks make daily nature available.");
    expect(persisted).not.toMatch(/"(?:transcript|notes|readiness|shapes)"/);

    act(() => button("Draft Snapshot").click());
    await act(async () => button("Refresh from current Article").click());
    await settle();
    const critiqueCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/suggestions" || url === "/api/snapshot");
    expect(critiqueCalls).toHaveLength(2);
    for (const [, init] of critiqueCalls) {
      const payload = String(init?.body);
      expect(payload).not.toContain("Parks make daily nature available.");
      expect(payload).not.toMatch(/"(?:transcript|notes|readiness|shapes)"/);
    }
    expect(JSON.stringify(editorHarness.content)).toBe(articleBefore);

    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<CoachWorkspace />));
    await settle();
    expect(document.querySelector('[aria-label="Close Thought Development"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Parks make daily nature available.");
    expect(JSON.stringify(editorHarness.content)).toBe(articleBefore);
  });
});
