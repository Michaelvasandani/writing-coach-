"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import UniqueID from "@tiptap/extension-unique-id";
import type { JSONContent } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachingExtension } from "@/lib/editor/coaching-extension";
import { isCurrentRevision } from "@/lib/coaching";
import { hashArticleContent } from "@/lib/thought-development";
import type { ArticleBlock, DraftSnapshot, Suggestion, ThoughtArticleBoundary, ThoughtSource } from "@/lib/types";
import ThoughtDevelopmentDialog from "@/app/thought-development-dialog";

type Tab = "priorities" | "suggestions" | "snapshot";
type SavedState = {
  articleId: string; revision: number; content: JSONContent; purpose: string; audience: string;
  context: string[]; suggestions: Suggestion[]; snapshot: DraftSnapshot | null;
};
type ThoughtLaunch = { articleBoundary: ThoughtArticleBoundary; initialTopic: string; source: ThoughtSource };
type SelectedPassage = { text: string; blockId?: string; from: number; to: number };

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

function suggestionSourceText(suggestion: Suggestion) {
  return [suggestion.observation, suggestion.readerImpact, suggestion.direction].join("\n");
}

function prioritySourceText(priority: DraftSnapshot["priorities"][number]) {
  return [priority.guidance, priority.why].join("\n");
}

export default function CoachWorkspace() {
  const [saved, setSaved] = useState<SavedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("priorities");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Set purpose and audience, then begin writing.");
  const [explanation, setExplanation] = useState("");
  const [thoughtLaunch, setThoughtLaunch] = useState<ThoughtLaunch | null>(null);
  const [selectedPassage, setSelectedPassage] = useState<SelectedPassage | null>(null);
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
    },
    onSelectionUpdate({ editor }) {
      const { from, to, $from } = editor.state.selection;
      const text = from === to ? "" : editor.state.doc.textBetween(from, to, " ").trim();
      setSelectedPassage(text ? { text, blockId: $from.parent.attrs.id as string | undefined, from, to } : null);
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
  useEffect(() => { editor?.setEditable(!thoughtLaunch); }, [editor, thoughtLaunch]);

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

  function beginThought(source: ThoughtSource = { kind: "general" }, initialTopic = saved.purpose) {
    const content = editor?.getJSON() ?? saved.content;
    setThoughtLaunch({ articleBoundary: { articleId: saved.articleId, revision: saved.revision, contentHash: hashArticleContent(content) }, initialTopic, source });
  }

  function validateThoughtSource(source: ThoughtSource, boundary: ThoughtArticleBoundary) {
    if (source.kind === "general") return null;
    const content = editor?.getJSON() ?? saved.content;
    const currentBoundary = { articleId: saved.articleId, revision: saved.revision, contentHash: hashArticleContent(content) };
    if (currentBoundary.articleId !== boundary.articleId || currentBoundary.revision !== boundary.revision || currentBoundary.contentHash !== boundary.contentHash) {
      return "The Article changed after this context was selected. Close this setup and choose the passage or coaching item again.";
    }
    if (source.kind === "passage") {
      const currentText = editor?.state.doc.textBetween(source.from, source.to, " ").trim();
      return currentText === source.text ? null : "That selected passage is no longer available. Close this setup and select it again.";
    }
    if (source.kind === "suggestion") {
      const current = saved.suggestions.find((item) => item.id === source.suggestionId && item.status === "active");
      return current && suggestionSourceText(current) === source.text ? null : "That Suggestion is no longer available. Close this setup and choose a current Suggestion.";
    }
    const current = saved.snapshot?.priorities.find((item) => item.rank === source.rank);
    return saved.snapshot?.revision === saved.revision && current && prioritySourceText(current) === source.text
      ? null
      : "That Draft Snapshot Priority is outdated. Refresh the Snapshot before developing it.";
  }

  function clearArticle() {
    if (!confirm("Clear this Article and its coaching context?")) return;
    setSaved({ ...initialState, articleId: crypto.randomUUID() }); editor?.commands.setContent(blankContent); setSelectedId(null);
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">M</span><div><strong>Margin</strong><small>Writing coach · local prototype</small></div></div><div className="status"><span className={busy ? "pulse" : "dot"} />{busy || notice}</div><button className="text-button" onClick={clearArticle} disabled={!!thoughtLaunch}>New article</button></header>
    <section className="workspace">
      <article className="paper">
        <div className="article-meta"><label>Purpose<input value={saved.purpose} disabled={!!thoughtLaunch} onChange={(event) => setSaved((current) => ({ ...current, purpose: event.target.value }))} placeholder="What should this article do?" /></label><label>Audience<input value={saved.audience} disabled={!!thoughtLaunch} onChange={(event) => setSaved((current) => ({ ...current, audience: event.target.value }))} placeholder="Who is it for?" /></label></div>
        <EditorContent editor={editor} />
        <footer className="editor-footer"><span>{wordCount(editor)} words</span>{selectedPassage && !thoughtLaunch ? <button className="text-button" onClick={() => beginThought({ kind: "passage", ...selectedPassage }, selectedPassage.text)}>Develop selected passage</button> : null}<span>Saved in this browser</span></footer>
      </article>
      <aside className="coach-panel">
        <div className="coach-heading"><div><span className="eyebrow">Coach panel</span><h2>Keep the pen.</h2></div><button className="thought-button" onClick={() => beginThought()}>Develop your ideas</button></div>
        <nav className="tabs" aria-label="Coach views">{(["priorities", "suggestions", "snapshot"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "snapshot" ? "Draft Snapshot" : item[0].toUpperCase() + item.slice(1)}{item === "suggestions" && saved.suggestions.filter((s) => s.status === "active").length ? <b>{saved.suggestions.filter((s) => s.status === "active").length}</b> : null}</button>)}</nav>
        <div className="panel-body">
          {tab === "priorities" && <div><p className="panel-intro">The few changes most likely to improve this draft. Only a fresh Snapshot can change them.</p>{saved.snapshot?.priorities.length ? saved.snapshot.priorities.map((priority) => <section className="priority-card" key={priority.rank}><span>{priority.rank}</span><div><small>{priority.category.replace("-", " ")}</small><h3>{priority.guidance}</h3><p>{priority.why}</p><button className="text-button" onClick={() => beginThought({ kind: "priority", rank: priority.rank, text: prioritySourceText(priority) }, priority.guidance)}>Develop this priority</button></div></section>) : <Empty title="No Priorities yet" body="When the draft has enough substance, refresh its Snapshot. The Coach will select up to three meaningful improvements—not filler." action="Refresh Snapshot" onAction={refreshSnapshot} />}</div>}
          {tab === "suggestions" && <div>{selected ? <SuggestionDetail suggestion={selected} explanation={explanation} setExplanation={setExplanation} onSave={saveExplanation} onDismiss={() => dismiss(selected)} onDevelop={() => beginThought({ kind: "suggestion", suggestionId: selected.id, text: suggestionSourceText(selected) }, selected.observation)} onBack={() => setSelectedId(null)} /> : <><p className="panel-intro">Quiet observations anchored to your words. Select an underline or a card to inspect it.</p>{saved.suggestions.filter((s) => s.status === "active").map((suggestion) => <button className="suggestion-card" key={suggestion.id} onClick={() => setSelectedId(suggestion.id)}><span className={`kind kind--${suggestion.category}`} /> <small>{suggestion.scope} · {suggestion.category.replace("-", " ")}</small><strong>{suggestion.observation}</strong><p>{suggestion.readerImpact}</p></button>)}{!saved.suggestions.some((s) => s.status === "active") && <Empty title="A quiet margin" body="Pause after editing a passage. The Coach stays silent unless it finds meaningful reader friction." />}</>}</div>}
          {tab === "snapshot" && <SnapshotView snapshot={saved.snapshot} outdated={snapshotOutdated} onRefresh={refreshSnapshot} />}
        </div>
        {saved.context.length ? <details className="context"><summary>Coaching Context <span>{saved.context.length}</span></summary>{saved.context.map((item, index) => <div key={`${item}-${index}`}>{item}<button onClick={() => setSaved((current) => ({ ...current, context: current.context.filter((_, i) => i !== index), snapshot: current.snapshot ? { ...current.snapshot, revision: -1 } : null }))}>×</button></div>)}</details> : null}
      </aside>
    </section>
    {thoughtLaunch && <ThoughtDevelopmentDialog articleBoundary={thoughtLaunch.articleBoundary} initialTopic={thoughtLaunch.initialTopic} source={thoughtLaunch.source} validateSource={validateThoughtSource} onClose={() => setThoughtLaunch(null)} />}
  </main>;
}

function Empty({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) { return <div className="empty"><span>✦</span><h3>{title}</h3><p>{body}</p>{action && <button onClick={onAction}>{action}</button>}</div>; }

function SuggestionDetail({ suggestion, explanation, setExplanation, onSave, onDismiss, onDevelop, onBack }: { suggestion: Suggestion; explanation: string; setExplanation: (value: string) => void; onSave: () => void; onDismiss: () => void; onDevelop: () => void; onBack: () => void }) { return <div className="detail"><button className="back" onClick={onBack}>← All suggestions</button><small>{suggestion.scope} · {suggestion.category.replace("-", " ")}</small><h3>{suggestion.observation}</h3><h4>Reader impact</h4><p>{suggestion.readerImpact}</p><h4>Direction</h4><p>{suggestion.direction}</p>{suggestion.intentQuestion && <blockquote>{suggestion.intentQuestion}</blockquote>}<button className="text-button" onClick={onDevelop}>Develop this suggestion</button><div className="explain"><label>Explain your choice<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Tell the Coach what you intended…" /></label><button onClick={onSave} disabled={!explanation.trim()}>Reassess</button></div><button className="dismiss" onClick={onDismiss}>Dismiss this suggestion</button></div>; }

function SnapshotView({ snapshot, outdated, onRefresh }: { snapshot: DraftSnapshot | null; outdated: boolean; onRefresh: () => void }) { if (!snapshot) return <Empty title="No Snapshot yet" body="Request an assessment when you want a deliberate checkpoint. Scores never change silently." action="Refresh Snapshot" onAction={onRefresh} />; return <div><div className="snapshot-score"><div>{snapshot.overall ?? "—"}<small>{snapshot.overall === null ? "Not enough evidence" : "/ 100"}</small></div><span className={outdated ? "outdated" : "current"}>{outdated ? "Outdated" : snapshot.provisional ? "Provisional" : "Current"}</span></div><button className="refresh" onClick={onRefresh}>Refresh from current Article</button><div className="judgments">{snapshot.judgments.map((item) => <section key={item.category}><header><strong>{item.category.replace("-", " ")}</strong><b>{item.score ?? "—"}</b></header><div className="meter"><i style={{ width: item.score ? `${item.score * 20}%` : "0%" }} /></div><p>{item.explanation}</p><small>{item.confidence} confidence</small></section>)}</div></div>; }
