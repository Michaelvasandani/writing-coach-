"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import UniqueID from "@tiptap/extension-unique-id";
import type { JSONContent } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachingExtension } from "@/lib/editor/coaching-extension";
import { isCurrentRevision } from "@/lib/coaching";
import type { ArticleBlock, DraftSnapshot, Suggestion } from "@/lib/types";

type Tab = "priorities" | "suggestions" | "snapshot";
type SavedState = {
  articleId: string; revision: number; content: JSONContent; purpose: string; audience: string;
  context: string[]; suggestions: Suggestion[]; snapshot: DraftSnapshot | null;
};

const storageKey = "margin-writing-coach.v1";
const blankContent: JSONContent = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Untitled article" }] }, { type: "paragraph" }] };
const initialState: SavedState = { articleId: "article-local", revision: 0, content: blankContent, purpose: "", audience: "", context: [], suggestions: [], snapshot: null };

function articleBlocks(editor: NonNullable<ReturnType<typeof useEditor>>): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  editor.state.doc.descendants((node) => {
    if ((node.type.name === "paragraph" || node.type.name === "heading") && node.attrs.id) blocks.push({ id: node.attrs.id, type: node.type.name, text: node.textContent });
  });
  return blocks;
}

function wordCount(editor: NonNullable<ReturnType<typeof useEditor>> | null) {
  return editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0;
}

export default function CoachWorkspace() {
  const [saved, setSaved] = useState<SavedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("priorities");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Set purpose and audience, then begin writing.");
  const [explanation, setExplanation] = useState("");
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [thoughtInput, setThoughtInput] = useState("");
  const [thoughtMessages, setThoughtMessages] = useState<{ role: "coach" | "writer"; text: string }[]>([]);
  const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(saved);
  stateRef.current = saved;

  const requestSuggestions = useCallback(async (mode: "changed_block" | "whole_article" | "reassess", blocks: ArticleBlock[], revision: number, changedBlockId?: string, context = stateRef.current.context) => {
    if (!stateRef.current.purpose || !stateRef.current.audience || !blocks.some((block) => block.text.trim())) return;
    setBusy(mode === "changed_block" ? "Reading the passage…" : "Reading the whole article…");
    try {
      const response = await fetch("/api/suggestions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        articleId: stateRef.current.articleId, revision, mode, changedBlockId, blocks,
        purpose: stateRef.current.purpose, audience: stateRef.current.audience, context,
        activeSuggestions: stateRef.current.suggestions.filter((item) => item.status === "active")
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const candidates: Suggestion[] = data.candidates.map((item: Omit<Suggestion, "id" | "status" | "createdAt">, index: number) => ({ ...item, id: `s-${revision}-${index}-${Date.now()}`, status: "active", createdAt: Date.now() }));
      setSaved((current) => current.revision === revision ? { ...current, suggestions: [...current.suggestions.filter((item) => !data.dispositions.some((d: { suggestionId: string; action: string }) => d.suggestionId === item.id && d.action === "retire")), ...candidates].slice(-8) } : current);
      setNotice(candidates.length ? `${candidates.length} quiet suggestion${candidates.length === 1 ? "" : "s"} added.` : "Nothing worth interrupting you about.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Coach unavailable"); }
    finally { setBusy(null); }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, UniqueID.configure({ types: ["paragraph", "heading"] }), Placeholder.configure({ placeholder: "Start with what you want to say…" }), CoachingExtension],
    content: blankContent,
    editorProps: {
      attributes: { class: "article-editor" },
      handleClick(_view, _pos, event) {
        const mark = (event.target as HTMLElement).closest<HTMLElement>("[data-suggestion-id]");
        if (mark?.dataset.suggestionId) { setSelectedId(mark.dataset.suggestionId); setTab("suggestions"); }
        return false;
      }
    },
    onUpdate({ editor }) {
      if (!hydrated) return;
      const content = editor.getJSON();
      const blocks = articleBlocks(editor);
      const changedBlockId = editor.state.selection.$from.parent.attrs.id as string | undefined;
      const nextRevision = stateRef.current.revision + 1;
      setSaved((current) => ({ ...current, revision: nextRevision, content, snapshot: current.snapshot ? { ...current.snapshot } : null }));
      if (analysisTimer.current) clearTimeout(analysisTimer.current);
      analysisTimer.current = setTimeout(() => requestSuggestions("changed_block", blocks, nextRevision, changedBlockId), 1400);
    }
  });

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try { const restored = JSON.parse(raw) as SavedState; setSaved(restored); editor?.commands.setContent(restored.content); }
      catch { localStorage.removeItem(storageKey); }
    }
    setHydrated(true);
  }, [editor]);

  useEffect(() => { if (hydrated) localStorage.setItem(storageKey, JSON.stringify(saved)); }, [saved, hydrated]);
  useEffect(() => { editor?.commands.setCoachingSuggestions(saved.suggestions.filter((item) => item.status === "active")); }, [editor, saved.suggestions]);

  const selected = useMemo(() => saved.suggestions.find((item) => item.id === selectedId) ?? null, [saved.suggestions, selectedId]);
  const snapshotOutdated = saved.snapshot ? saved.snapshot.revision !== saved.revision : false;

  async function refreshSnapshot() {
    if (!editor) return;
    const blocks = articleBlocks(editor);
    setBusy("Refreshing the Draft Snapshot…");
    try {
      const [response] = await Promise.all([
        fetch("/api/snapshot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ articleId: saved.articleId, revision: saved.revision, blocks, wordCount: wordCount(editor), purpose: saved.purpose, audience: saved.audience, context: saved.context, activeSuggestions: saved.suggestions }) }),
        requestSuggestions("whole_article", blocks, saved.revision)
      ]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSaved((current) => isCurrentRevision(saved.revision, current.revision) ? { ...current, snapshot: { revision: saved.revision, judgments: data.judgments, priorities: data.priorities, overall: data.overall, provisional: data.provisional, createdAt: Date.now() } } : current);
      setTab("priorities"); setNotice("Snapshot refreshed from the current Article.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Snapshot failed"); }
    finally { setBusy(null); }
  }

  function dismiss(suggestion: Suggestion) {
    setSaved((current) => ({ ...current, suggestions: current.suggestions.map((item) => item.id === suggestion.id ? { ...item, status: "dismissed" } : item) }));
    setSelectedId(null); setNotice("Dismissed until its evidence materially changes.");
  }

  async function saveExplanation() {
    if (!selected || !explanation.trim() || !editor) return;
    const entry = `${selected.category}: ${explanation.trim()}`;
    const context = [...saved.context, entry];
    setSaved((current) => ({ ...current, context, snapshot: current.snapshot ? { ...current.snapshot, revision: -1 } : null }));
    setExplanation(""); setNotice("Explanation added to this Article; reassessing related feedback.");
    await requestSuggestions("reassess", articleBlocks(editor), saved.revision, undefined, context);
  }

  async function beginThought() {
    setThoughtOpen(true); setThoughtMessages([]); setThoughtInput("");
    await askThought("meaning", "What rough thought do you want to develop?", []);
  }

  async function askThought(targetNodeId: string, seed: string, messages: { role: "coach" | "writer"; text: string }[]) {
    setBusy("Finding the next useful question…");
    const sessionId = "thought-local"; const turnId = `turn-${messages.length}`;
    try {
      const response = await fetch("/api/thought-development", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, turnId, targetNodeId, selectedThought: seed, messages, articleBoundary: { articleId: saved.articleId, revision: saved.revision } }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (data.question) setThoughtMessages([...messages, { role: "coach", text: data.question }]);
      else if (data.summary) setThoughtMessages([...messages, { role: "coach", text: data.summary }]);
    } catch (error) { setThoughtMessages([...messages, { role: "coach", text: error instanceof Error ? error.message : "Coach unavailable" }]); }
    finally { setBusy(null); }
  }

  async function submitThought() {
    if (!thoughtInput.trim()) return;
    const messages = [...thoughtMessages, { role: "writer" as const, text: thoughtInput.trim() }];
    setThoughtMessages(messages); setThoughtInput("");
    const writerTurns = messages.filter((item) => item.role === "writer").length;
    const target = writerTurns === 1 ? "reason" : writerTurns === 2 ? "place" : "completion";
    await askThought(target, messages[1]?.text || "", messages);
  }

  function clearArticle() {
    if (!confirm("Clear this Article and its coaching context?")) return;
    setSaved({ ...initialState, articleId: crypto.randomUUID() }); editor?.commands.setContent(blankContent); setSelectedId(null);
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><div><strong>Margin</strong><small>Writing coach · local prototype</small></div></div><div className="status"><span className={busy ? "pulse" : "dot"} />{busy || notice}</div><button className="text-button" onClick={clearArticle}>New article</button></header>
    <section className="workspace">
      <article className="paper">
        <div className="article-meta"><label>Purpose<input value={saved.purpose} onChange={(event) => setSaved((current) => ({ ...current, purpose: event.target.value }))} placeholder="What should this article do?" /></label><label>Audience<input value={saved.audience} onChange={(event) => setSaved((current) => ({ ...current, audience: event.target.value }))} placeholder="Who is it for?" /></label></div>
        <EditorContent editor={editor} />
        <footer className="editor-footer"><span>{wordCount(editor)} words</span><span>Saved in this browser</span></footer>
      </article>
      <aside className="coach-panel">
        <div className="coach-heading"><div><span className="eyebrow">Coach panel</span><h2>Keep the pen.</h2></div><button className="thought-button" onClick={beginThought}>Develop a thought</button></div>
        <nav className="tabs" aria-label="Coach views">{(["priorities", "suggestions", "snapshot"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "snapshot" ? "Draft Snapshot" : item[0].toUpperCase() + item.slice(1)}{item === "suggestions" && saved.suggestions.filter((s) => s.status === "active").length ? <b>{saved.suggestions.filter((s) => s.status === "active").length}</b> : null}</button>)}</nav>
        <div className="panel-body">
          {tab === "priorities" && <div><p className="panel-intro">The few changes most likely to improve this draft. Only a fresh Snapshot can change them.</p>{saved.snapshot?.priorities.length ? saved.snapshot.priorities.map((priority) => <section className="priority-card" key={priority.rank}><span>{priority.rank}</span><div><small>{priority.category.replace("-", " ")}</small><h3>{priority.guidance}</h3><p>{priority.why}</p></div></section>) : <Empty title="No Priorities yet" body="When the draft has enough substance, refresh its Snapshot. The Coach will select up to three meaningful improvements—not filler." action="Refresh Snapshot" onAction={refreshSnapshot} />}</div>}
          {tab === "suggestions" && <div>{selected ? <SuggestionDetail suggestion={selected} explanation={explanation} setExplanation={setExplanation} onSave={saveExplanation} onDismiss={() => dismiss(selected)} onBack={() => setSelectedId(null)} /> : <><p className="panel-intro">Quiet observations anchored to your words. Select an underline or a card to inspect it.</p>{saved.suggestions.filter((s) => s.status === "active").map((suggestion) => <button className="suggestion-card" key={suggestion.id} onClick={() => setSelectedId(suggestion.id)}><span className={`kind kind--${suggestion.category}`} /> <small>{suggestion.scope} · {suggestion.category.replace("-", " ")}</small><strong>{suggestion.observation}</strong><p>{suggestion.readerImpact}</p></button>)}{!saved.suggestions.some((s) => s.status === "active") && <Empty title="A quiet margin" body="Pause after editing a passage. The Coach stays silent unless it finds meaningful reader friction." />}</>}</div>}
          {tab === "snapshot" && <SnapshotView snapshot={saved.snapshot} outdated={snapshotOutdated} onRefresh={refreshSnapshot} />}
        </div>
        {saved.context.length ? <details className="context"><summary>Coaching Context <span>{saved.context.length}</span></summary>{saved.context.map((item, index) => <div key={`${item}-${index}`}>{item}<button onClick={() => setSaved((current) => ({ ...current, context: current.context.filter((_, i) => i !== index), snapshot: current.snapshot ? { ...current.snapshot, revision: -1 } : null }))}>×</button></div>)}</details> : null}
      </aside>
    </section>
    {thoughtOpen && <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="thought-title"><div className="thought-modal"><header><div><span className="eyebrow">Thought development</span><h2 id="thought-title">Find what you mean</h2></div><button aria-label="Close Thought Development" onClick={() => setThoughtOpen(false)}>×</button></header><div className="thought-stream">{thoughtMessages.length ? thoughtMessages.map((message, index) => <div key={index} className={`thought-message ${message.role}`}><small>{message.role === "coach" ? "Coach" : "You"}</small><p>{message.text}</p></div>) : <p className="muted">The Article remains unchanged behind this conversation.</p>}</div><div className="thought-compose"><textarea aria-label="Your thought" value={thoughtInput} onChange={(event) => setThoughtInput(event.target.value)} placeholder="Answer in your own rough words…" /><button onClick={submitThought} disabled={!thoughtInput.trim() || !!busy}>Continue</button></div><footer>Your answers stay as notes. The Coach will not turn them into publishable prose.</footer></div></div>}
  </main>;
}

function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) { return <div className="empty"><span>✦</span><h3>{title}</h3><p>{body}</p>{action && <button onClick={onAction}>{action}</button>}</div>; }

function SuggestionDetail({ suggestion, explanation, setExplanation, onSave, onDismiss, onBack }: { suggestion: Suggestion; explanation: string; setExplanation: (value: string) => void; onSave: () => void; onDismiss: () => void; onBack: () => void }) { return <div className="detail"><button className="back" onClick={onBack}>← All suggestions</button><small>{suggestion.scope} · {suggestion.category.replace("-", " ")}</small><h3>{suggestion.observation}</h3><h4>Reader impact</h4><p>{suggestion.readerImpact}</p><h4>Direction</h4><p>{suggestion.direction}</p>{suggestion.intentQuestion && <blockquote>{suggestion.intentQuestion}</blockquote>}<div className="explain"><label>Explain your choice<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Tell the Coach what you intended…" /></label><button onClick={onSave} disabled={!explanation.trim()}>Reassess</button></div><button className="dismiss" onClick={onDismiss}>Dismiss this suggestion</button></div>; }

function SnapshotView({ snapshot, outdated, onRefresh }: { snapshot: DraftSnapshot | null; outdated: boolean; onRefresh: () => void }) { if (!snapshot) return <Empty title="No Snapshot yet" body="Request an assessment when you want a deliberate checkpoint. Scores never change silently." action="Refresh Snapshot" onAction={onRefresh} />; return <div><div className="snapshot-score"><div>{snapshot.overall ?? "—"}<small>{snapshot.overall === null ? "Not enough evidence" : "/ 100"}</small></div><span className={outdated ? "outdated" : "current"}>{outdated ? "Outdated" : snapshot.provisional ? "Provisional" : "Current"}</span></div><button className="refresh" onClick={onRefresh}>Refresh from current Article</button><div className="judgments">{snapshot.judgments.map((item) => <section key={item.category}><header><strong>{item.category.replace("-", " ")}</strong><b>{item.score ?? "—"}</b></header><div className="meter"><i style={{ width: item.score ? `${item.score * 20}%` : "0%" }} /></div><p>{item.explanation}</p><small>{item.confidence} confidence</small></section>)}</div></div>; }
