"use client";

import { useState } from "react";
import { articleShapeOutputSchema, thoughtOutputSchema } from "@/lib/contracts/thought";
import {
  applyArticleShapeResponse,
  beginArticleShapeExploration,
  buildArticleShapeRequest,
  buildThoughtRequest,
  canExploreArticleShapes,
  createThoughtDevelopmentSession,
  deleteSessionNote,
  editSessionNote,
  failArticleShapeRequest,
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
  updateDevelopmentFocus
} from "@/lib/thought-development";
import type { ArticleShape, DevelopmentFocus, SessionNote, ThoughtArticleBoundary, ThoughtDevelopmentSession, ThoughtSource } from "@/lib/types";

type Props = {
  articleBoundary: ThoughtArticleBoundary;
  initialTopic: string;
  source?: ThoughtSource;
  validateSource?: (source: ThoughtSource, articleBoundary: ThoughtArticleBoundary) => string | null;
  onClose: () => void;
};

const focusOptions: { value: DevelopmentFocus; label: string; detail: string }[] = [
  { value: "thinking", label: "Develop my thinking", detail: "Clarify the point, reasoning, support, and reader relevance." },
  { value: "structure", label: "Find a structure", detail: "Work out how your existing ideas could be arranged." },
  { value: "both", label: "Do both", detail: "Develop the substance, then consider its organization." }
];

const sourceLabels: Record<ThoughtSource["kind"], string> = {
  general: "General topic",
  passage: "Selected passage",
  suggestion: "Suggestion",
  priority: "Draft Snapshot Priority"
};

const readinessLabels = { unresolved: "Unresolved", addressed: "Addressed", skipped: "Skipped" } as const;

function NoteEditor({ note, session, onSave, onDelete }: {
  note: SessionNote;
  session: ThoughtDevelopmentSession;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(note.text);
  const sources = session.transcript.filter((turn) => turn.role === "writer" && note.sourceTurnIds.includes(turn.id));
  const role = session.nodes.find((node) => node.id === note.role)?.label ?? note.role;
  return <article className="session-note">
    <header><strong>{role}</strong>{note.needsReview && <span>Needs review</span>}</header>
    <textarea aria-label={`Edit ${role} note`} value={draft} onChange={(event) => setDraft(event.target.value)} />
    <small>Supported by: {sources.map((turn) => turn.text).join(" · ")}</small>
    <div><button onClick={() => onSave(draft)} disabled={!draft.trim()}>Save note</button><button className="danger" onClick={onDelete}>Delete note</button></div>
  </article>;
}

function ShapeEditor({ shape, session, onRename, onReorder, onMoveNote, onRemoveNote }: {
  shape: ArticleShape;
  session: ThoughtDevelopmentSession;
  onRename: (sectionId: string, purpose: string) => void;
  onReorder: (sectionId: string, direction: "up" | "down") => void;
  onMoveNote: (noteId: string, sectionId: string) => void;
  onRemoveNote: (noteId: string) => void;
}) {
  const [purposeDrafts, setPurposeDrafts] = useState<Record<string, string>>({});
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  return <div className="shape-editor">
    <strong>Selected Shape</strong>
    {shape.sections.map((section, index) => {
      const purpose = purposeDrafts[section.id] ?? section.purpose;
      return <article className="shape-section" key={section.id}>
        <div className="shape-section-header">
          <input aria-label={`Rename ${section.purpose}`} value={purpose} onChange={(event) => setPurposeDrafts((drafts) => ({ ...drafts, [section.id]: event.target.value }))} />
          <button onClick={() => onRename(section.id, purpose)} disabled={!purpose.trim()}>Save purpose</button>
          <button onClick={() => onReorder(section.id, "up")} disabled={index === 0}>Move {section.purpose} up</button>
          <button onClick={() => onReorder(section.id, "down")} disabled={index === shape.sections.length - 1}>Move {section.purpose} down</button>
        </div>
        {section.noteIds.map((noteId) => {
          const note = session.notes.find((item) => item.id === noteId);
          if (!note) return null;
          const otherSections = shape.sections.filter((item) => item.id !== section.id);
          const target = moveTargets[noteId] ?? otherSections[0]?.id ?? "";
          return <div className="shape-note" key={noteId}>
            <span>{note.text}</span>
            {otherSections.length > 0 && <><select aria-label={`Move ${note.text}`} value={target} onChange={(event) => setMoveTargets((targets) => ({ ...targets, [noteId]: event.target.value }))}>
              {otherSections.map((item) => <option key={item.id} value={item.id}>{item.purpose}</option>)}
            </select><button onClick={() => onMoveNote(noteId, target)}>Move note</button></>}
            <button onClick={() => onRemoveNote(noteId)}>Remove {note.text}</button>
          </div>;
        })}
      </article>;
    })}
  </div>;
}

export default function ThoughtDevelopmentDialog({ articleBoundary, initialTopic, source, validateSource, onClose }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [focus, setFocus] = useState<DevelopmentFocus>("thinking");
  const [session, setSession] = useState<ThoughtDevelopmentSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const launchSource = source ?? { kind: "general" as const };
  const [notesOpen, setNotesOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [revisionTurnId, setRevisionTurnId] = useState<string | null>(null);
  const [revisionDraft, setRevisionDraft] = useState("");
  const [clearedCheckpoint, setClearedCheckpoint] = useState<number | null>(null);

  async function sendRequest(current: ThoughtDevelopmentSession) {
    try {
      const response = await fetch("/api/thought-development", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildThoughtRequest(current))
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const error = typeof body === "object" && body && "error" in body ? String(body.error) : "Coach unavailable";
        throw new Error(error);
      }
      const parsed = thoughtOutputSchema.safeParse(body);
      if (!parsed.success) throw new Error("The Coach returned an incomplete response. You can retry safely.");
      setSession((latest) => latest ? thoughtDevelopmentReducer(latest, { type: "response_received", response: parsed.data }) : latest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Coach unavailable";
      setSession((latest) => latest ? thoughtDevelopmentReducer(latest, { type: "request_failed", message }) : latest);
    }
  }

  async function sendShapeRequest(current: ThoughtDevelopmentSession) {
    try {
      const response = await fetch("/api/thought-development", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildArticleShapeRequest(current))
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const error = typeof body === "object" && body && "error" in body ? String(body.error) : "Coach unavailable";
        throw new Error(error);
      }
      const parsed = articleShapeOutputSchema.safeParse(body);
      if (!parsed.success) throw new Error("The Coach returned invalid Article Shapes. Your Session is unchanged.");
      setSession((latest) => {
        if (!latest) return latest;
        try {
          return applyArticleShapeResponse(latest, parsed.data);
        } catch (error) {
          return failArticleShapeRequest(latest, error instanceof Error ? error.message : "The Coach returned invalid Article Shapes.");
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Coach unavailable";
      setSession((latest) => latest ? failArticleShapeRequest(latest, message) : latest);
    }
  }

  function beginSession() {
    if (!topic.trim()) return;
    const validationError = validateSource?.(launchSource, articleBoundary) ?? null;
    if (validationError) {
      setSetupError(validationError);
      return;
    }
    setSetupError(null);
    const created = createThoughtDevelopmentSession({
      id: crypto.randomUUID(),
      topic,
      focus,
      articleBoundary,
      requestId: crypto.randomUUID(),
      source: launchSource
    });
    setSession(created);
    void sendRequest(created);
  }

  function submitAnswer() {
    if (!session || !answer.trim()) return;
    const next = thoughtDevelopmentReducer(session, { type: "submit_answer", turnId: crypto.randomUUID(), text: answer });
    if (next === session) return;
    setSession(next);
    setAnswer("");
    void sendRequest(next);
  }

  function retry() {
    if (!session) return;
    const next = thoughtDevelopmentReducer(session, { type: "retry_request" });
    if (next === session) return;
    setSession(next);
    void sendRequest(next);
  }

  function exploreStructures() {
    if (!session || !canExploreArticleShapes(session)) return;
    const next = beginArticleShapeExploration(session, crypto.randomUUID());
    if (next === session) return;
    setSession(next);
    void sendShapeRequest(next);
  }

  function retryStructures() {
    if (!session) return;
    const next = retryArticleShapeRequest(session);
    if (next === session) return;
    setSession(next);
    void sendShapeRequest(next);
  }

  function skip() {
    if (!session) return;
    const next = skipThoughtNode(session, crypto.randomUUID());
    if (next === session) return;
    setSession(next);
    if (next.request) void sendRequest(next);
  }

  function beginRevision(turnId: string, text: string) {
    setRevisionTurnId(turnId);
    setRevisionDraft(text);
  }

  function saveRevision() {
    if (!session || !revisionTurnId) return;
    const next = reviseThoughtAnswer(session, revisionTurnId, revisionDraft);
    if (next === session) return;
    setRevisionTurnId(null);
    setSession(next);
    void sendRequest(next);
  }

  const pending = session?.request?.status === "pending";
  const shapePending = session?.shapeRequest?.status === "pending";
  const questionCount = session?.transcript.filter((turn) => turn.role === "coach").length ?? 0;
  const checkpoint = !!session && session.phase === "active" && !session.request && isThoughtCheckpoint(questionCount) && clearedCheckpoint !== questionCount;
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="thought-title">
    <div className={`thought-modal${notesOpen ? " notes-open" : ""}`}>
      <header>
        <div><span className="eyebrow">Thought development · Temporary Session</span><h2 id="thought-title">Develop your ideas</h2></div>
        <button aria-label="Close Thought Development" onClick={onClose}>×</button>
      </header>
      {!session ? <div className="thought-setup">
        <p>This workspace lasts only while this dialog is open. Your Article stays visible, read-only, and unchanged.</p>
        {launchSource.kind !== "general" && <div className="thought-context">
          <strong>{sourceLabels[launchSource.kind]}</strong>
          <span>{launchSource.text}</span>
        </div>}
        <label>Topic<textarea aria-label="Topic" value={topic} onChange={(event) => { setTopic(event.target.value); setSetupError(null); }} placeholder="What do you want to work out?" /></label>
        {setupError && <div className="thought-error" role="alert"><p>{setupError}</p></div>}
        <fieldset><legend>Development Focus</legend>{focusOptions.map((option) => <label key={option.value} className="focus-option">
          <input aria-label={option.label} type="radio" name="thought-focus" value={option.value} checked={focus === option.value} onChange={() => setFocus(option.value)} />
          <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        </label>)}</fieldset>
        <button className="primary" onClick={beginSession} disabled={!topic.trim()}>Begin Session</button>
      </div> : <>
        <div className="thought-context"><strong>{session.topic}</strong><span>{focusOptions.find((option) => option.value === session.focus)?.label}</span></div>
        <div className="thought-session-toolbar">
          <button onClick={() => setNotesOpen((open) => !open)}>Notes ({session.notes.length})</button>
          <button onClick={exploreStructures} disabled={pending || shapePending || !canExploreArticleShapes(session)}>{session.shapes.length ? "Regenerate structures" : "Explore structures"}</button>
          <button onClick={() => setFocusOpen((open) => !open)} disabled={pending || shapePending}>Change focus</button>
          <button onClick={() => setSession(finishThoughtDevelopment(session))} disabled={pending || shapePending || session.phase === "finished"}>Finish for now</button>
        </div>
        {!canExploreArticleShapes(session) && <p className="muted">Add a central-point note and at least two supporting notes to explore structures.</p>}
        {focusOpen && <fieldset className="thought-focus-picker"><legend>Development Focus</legend>{focusOptions.map((option) => <label key={option.value}>
          <input aria-label={option.label} type="radio" name="active-thought-focus" checked={session.focus === option.value} onChange={() => { setSession(updateDevelopmentFocus(session, option.value)); setFocusOpen(false); }} /> {option.label}
        </label>)}</fieldset>}
        <div className="thought-readiness" aria-label="Development Readiness">
          {session.nodes.map((node) => <div key={node.id} className={`readiness-${session.readiness[node.id]}`}><span>{node.label}</span><strong>{readinessLabels[session.readiness[node.id]]}</strong></div>)}
        </div>
        <div className="thought-session-body">
          <div className="thought-main">
            <div className="thought-stream" aria-live="polite">
              {session.transcript.map((turn) => <div key={turn.id} className={`thought-message ${turn.role}`}>
                <small>{turn.role === "coach" ? "Coach" : "You"}</small><p>{turn.text}</p>
                {turn.role === "writer" && turn.status === "accepted" && !session.request && session.phase === "active" && <button className="message-action" onClick={() => beginRevision(turn.id, turn.text)}>Revise answer</button>}
                {revisionTurnId === turn.id && <div className="thought-revision"><textarea aria-label="Revise your answer" value={revisionDraft} onChange={(event) => setRevisionDraft(event.target.value)} /><button onClick={saveRevision} disabled={!revisionDraft.trim()}>Save revision</button><button onClick={() => setRevisionTurnId(null)}>Cancel</button></div>}
              </div>)}
              {pending && <p className="muted">Finding the next useful question…</p>}
              {shapePending && <p className="muted">Arranging your current Session Notes…</p>}
              {session.lastError && <div className="thought-error" role="alert"><p>{session.lastError}</p><button onClick={session.shapeRequest?.status === "failed" ? retryStructures : retry}>Retry</button></div>}
              {session.shapeIssue && <div className="thought-error" role="alert"><strong>{session.nodes.find((node) => node.id === session.shapeIssue?.unresolvedArea)?.label} is unresolved</strong><p>{session.shapeIssue.question}</p></div>}
              {session.phase === "finished" && <div className="thought-finished"><strong>Partial thinking saved in this open Session</strong><p>You can review or edit these notes until you close the dialog.</p></div>}
              {checkpoint && <div className="thought-checkpoint"><strong>Pause and choose what is useful now.</strong><div><button onClick={() => setClearedCheckpoint(questionCount)}>Continue</button><button onClick={() => { setNotesOpen(true); setClearedCheckpoint(questionCount); }}>Review partial notes</button><button onClick={() => setSession(finishThoughtDevelopment(session))}>Finish for now</button></div></div>}
            </div>
            {session.phase === "active" && <div className="thought-compose">
              <textarea aria-label="Your answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer in your own rough words…" disabled={!!session.request || !!session.shapeRequest || checkpoint} />
              <div><button className="secondary" onClick={skip} disabled={!!session.request || !!session.shapeRequest || checkpoint}>Skip</button><button onClick={submitAnswer} disabled={!answer.trim() || !!session.request || !!session.shapeRequest || checkpoint}>Continue</button></div>
            </div>}
            {session.shapes.length > 0 && <section className="article-shapes" aria-label="Article Shapes">
              <header><span className="eyebrow">Temporary arrangements</span><h3>Article Shapes</h3></header>
              <div className="shape-options">{session.shapes.map((shape, index) => <article key={shape.id} className={session.selectedShapeId === shape.id ? "selected" : ""}>
                <strong>Shape {index + 1}</strong><p>{shape.organizingLogic}</p><small>Tradeoff: {shape.tradeoff}</small>
                <button onClick={() => setSession(selectArticleShape(session, shape.id))}>Select Shape {index + 1}</button>
              </article>)}</div>
              {session.shapes.find((shape) => shape.id === session.selectedShapeId) && <ShapeEditor
                key={session.selectedShapeId}
                shape={session.shapes.find((shape) => shape.id === session.selectedShapeId)!}
                session={session}
                onRename={(sectionId, purpose) => setSession(renameShapeSection(session, session.selectedShapeId!, sectionId, purpose))}
                onReorder={(sectionId, direction) => setSession(reorderShapeSection(session, session.selectedShapeId!, sectionId, direction))}
                onMoveNote={(noteId, sectionId) => setSession(moveShapeNote(session, session.selectedShapeId!, noteId, sectionId))}
                onRemoveNote={(noteId) => setSession(removeShapeNote(session, session.selectedShapeId!, noteId))}
              />}
            </section>}
          </div>
          {notesOpen && <aside className="thought-notes" aria-label="Session Notes">
            <header><div><span className="eyebrow">Working record</span><h3>Session Notes</h3></div><button aria-label="Close notes" onClick={() => setNotesOpen(false)}>×</button></header>
            {session.notes.length ? session.notes.map((note) => <NoteEditor key={note.id} note={note} session={session}
              onSave={(text) => setSession((current) => current ? editSessionNote(current, note.id, text) : current)}
              onDelete={() => setSession((current) => current ? deleteSessionNote(current, note.id) : current)} />) : <p className="muted">No notes collected yet.</p>}
          </aside>}
        </div>
      </>}
      <footer>Nothing here edits your Article or becomes coaching context. Closing the dialog discards this Session.</footer>
    </div>
  </div>;
}
