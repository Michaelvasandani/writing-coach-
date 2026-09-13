"use client";

import { useState } from "react";
import { thoughtOutputSchema } from "@/lib/contracts/thought";
import {
  buildThoughtRequest,
  createThoughtDevelopmentSession,
  thoughtDevelopmentReducer
} from "@/lib/thought-development";
import type { DevelopmentFocus, ThoughtArticleBoundary, ThoughtDevelopmentSession, ThoughtSource } from "@/lib/types";

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

export default function ThoughtDevelopmentDialog({ articleBoundary, initialTopic, source, validateSource, onClose }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [focus, setFocus] = useState<DevelopmentFocus>("thinking");
  const [session, setSession] = useState<ThoughtDevelopmentSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const launchSource = source ?? { kind: "general" as const };

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

  const pending = session?.request?.status === "pending";
  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="thought-title">
    <div className="thought-modal">
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
        <div className="thought-stream" aria-live="polite">
          {session.transcript.map((turn) => <div key={turn.id} className={`thought-message ${turn.role}`}>
            <small>{turn.role === "coach" ? "Coach" : "You"}</small><p>{turn.text}</p>
          </div>)}
          {pending && <p className="muted">Finding the next useful question…</p>}
          {session.lastError && <div className="thought-error" role="alert"><p>{session.lastError}</p><button onClick={retry}>Retry</button></div>}
        </div>
        <div className="thought-compose">
          <textarea aria-label="Your answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer in your own rough words…" disabled={!!session.request} />
          <button onClick={submitAnswer} disabled={!answer.trim() || !!session.request}>Continue</button>
        </div>
      </>}
      <footer>Nothing here edits your Article or becomes coaching context. Closing the dialog discards this Session.</footer>
    </div>
  </div>;
}
