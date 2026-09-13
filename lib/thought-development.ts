import type {
  DevelopmentFocus, DevelopmentReadiness, ProposedNoteChange, ThoughtArticleBoundary, ThoughtDevelopmentSession,
  ThoughtNode, ThoughtNodeId, ThoughtResponse, ThoughtSource
} from "@/lib/types";

export const canonicalThoughtNodes: ThoughtNode[] = [
  { id: "central_point", label: "Central point", required: true, prerequisites: [] },
  { id: "reasoning", label: "Reasoning", required: true, prerequisites: ["central_point"] },
  { id: "support", label: "Support or example", required: true, prerequisites: ["reasoning"] },
  { id: "reader_relevance", label: "Reader relevance", required: true, prerequisites: ["central_point"] },
  { id: "structural_placement", label: "Structural placement", required: true, prerequisites: ["central_point"] }
];

const focusOrder: Record<DevelopmentFocus, ThoughtNodeId[]> = {
  thinking: ["central_point", "reasoning", "reader_relevance", "support", "structural_placement"],
  structure: ["central_point", "structural_placement", "reasoning", "support", "reader_relevance"],
  both: ["central_point", "reasoning", "support", "reader_relevance", "structural_placement"]
};

function initialReadiness(): DevelopmentReadiness {
  return { central_point: "unresolved", reasoning: "unresolved", support: "unresolved", reader_relevance: "unresolved", structural_placement: "unresolved" };
}

export function deriveThoughtFrontier(nodes: ThoughtNode[], readiness: DevelopmentReadiness, focus: DevelopmentFocus): ThoughtNodeId[] {
  const available = nodes.filter((node) => readiness[node.id] === "unresolved")
    .filter((node) => node.prerequisites.every((id) => readiness[id] !== "unresolved")).map((node) => node.id);
  return focusOrder[focus].filter((id) => available.includes(id));
}

export function createThoughtDevelopmentSession(input: {
  id: string; topic: string; focus: DevelopmentFocus; articleBoundary: ThoughtArticleBoundary; requestId: string; source?: ThoughtSource;
}): ThoughtDevelopmentSession {
  const topic = input.topic.trim();
  if (!topic) throw new Error("A topic is required");
  const nodes = canonicalThoughtNodes.map((node) => ({ ...node, prerequisites: [...node.prerequisites] }));
  const readiness = initialReadiness();
  const frontier = deriveThoughtFrontier(nodes, readiness, input.focus);
  return {
    id: input.id, topic, focus: input.focus, source: input.source ?? { kind: "general" }, articleBoundary: { ...input.articleBoundary },
    nodes, readiness, frontier, transcript: [], notes: [], shapes: [], selectedShapeId: null,
    request: { turnId: input.requestId, targetNodeId: frontier[0], status: "pending" }, lastError: null
  };
}

export function isNeutralSingleQuestion(question: string): boolean {
  const normalized = question.trim();
  if (!normalized.endsWith("?") || (normalized.match(/\?/g) ?? []).length !== 1) return false;
  if (/\b(great|excellent|good|insightful|smart|strong|wonderful)\b/i.test(normalized)) return false;
  if (/\b(isn't|aren't|wouldn't|don't you (?:think|agree)|surely|obviously)\b/i.test(normalized)) return false;
  if (/\bor\b/i.test(normalized)) return false;
  if (/\band\s+(?:why|what|how|where|when|who|which|do|does|did|is|are|would|could|should)\b/i.test(normalized)) return false;
  return true;
}

function sameBoundary(a: ThoughtArticleBoundary, b: ThoughtArticleBoundary) {
  return a.articleId === b.articleId && a.revision === b.revision && a.contentHash === b.contentHash;
}

function applyNoteChanges(session: ThoughtDevelopmentSession, changes: ProposedNoteChange[]) {
  const notes = session.notes.map((note) => ({ ...note, sourceTurnIds: [...note.sourceTurnIds] }));
  const writerTurnIds = new Set(session.transcript.filter((turn) => turn.role === "writer").map((turn) => turn.id));
  for (const change of changes) {
    if (change.kind === "delete") {
      const index = notes.findIndex((note) => note.id === change.noteId);
      if (index >= 0 && notes[index].provenance !== "writer-edited") notes.splice(index, 1);
      continue;
    }
    if (!change.note.text.trim() || !change.note.sourceTurnIds.length || change.note.sourceTurnIds.some((id) => !writerTurnIds.has(id))) throw new Error("invalid Session Note source");
    const index = notes.findIndex((note) => note.id === change.note.id);
    if (index >= 0 && notes[index].provenance === "writer-edited") continue;
    const note = { ...change.note, text: change.note.text.trim(), sourceTurnIds: [...change.note.sourceTurnIds], provenance: "coach-proposed" as const };
    if (index >= 0) notes[index] = note; else notes.push(note);
  }
  return notes;
}

export function validateAndApplyThoughtResponse(session: ThoughtDevelopmentSession, response: ThoughtResponse): ThoughtDevelopmentSession {
  const request = session.request;
  if (!request || request.status !== "pending" || response.turnId !== request.turnId) throw new Error("stale turn identity");
  if (response.contract !== "thought-development.v1" || response.sessionId !== session.id || response.targetNodeId !== request.targetNodeId) throw new Error("stale Session identity");
  if (!sameBoundary(response.articleBoundary, session.articleBoundary)) throw new Error("Article boundary changed");
  if (!session.frontier.includes(request.targetNodeId)) throw new Error("target is not in the ready frontier");
  const writerTurn = session.transcript.find((turn) => turn.role === "writer" && turn.id === request.turnId);
  if (writerTurn) {
    if (response.readinessPatch.length > 1 || (response.readinessPatch[0] && response.readinessPatch[0].nodeId !== request.targetNodeId)) throw new Error("invalid readiness transition");
  } else if (response.readinessPatch.length) throw new Error("opening question cannot change readiness");

  const readiness = { ...session.readiness };
  for (const patch of response.readinessPatch) {
    if (readiness[patch.nodeId] !== "unresolved") throw new Error("invalid readiness transition");
    readiness[patch.nodeId] = patch.status;
  }
  const frontier = deriveThoughtFrontier(session.nodes, readiness, session.focus);
  if (response.nextAction.kind === "ask_question") {
    if (!frontier.includes(response.nextAction.targetNodeId)) throw new Error("next question does not target the ready frontier");
    if (!isNeutralSingleQuestion(response.nextAction.question)) throw new Error("question must be one neutral question");
  } else if (response.nextAction.kind === "complete" && session.nodes.some((node) => node.required && readiness[node.id] === "unresolved")) {
    throw new Error("Session is not complete");
  }

  const notes = applyNoteChanges(session, response.proposedNoteChanges);
  const transcript = session.transcript.map((turn) => turn.role === "writer" && turn.id === request.turnId ? { ...turn, status: "accepted" as const } : turn);
  if (response.nextAction.kind === "ask_question") transcript.push({ id: `coach-${response.turnId}`, role: "coach", targetNodeId: response.nextAction.targetNodeId, text: response.nextAction.question });
  return { ...session, readiness, frontier, notes, transcript, request: null, lastError: null };
}

export type ThoughtDevelopmentAction =
  | { type: "submit_answer"; turnId: string; text: string }
  | { type: "request_failed"; message: string }
  | { type: "retry_request" }
  | { type: "response_received"; response: ThoughtResponse };

export function thoughtDevelopmentReducer(session: ThoughtDevelopmentSession, action: ThoughtDevelopmentAction): ThoughtDevelopmentSession {
  if (action.type === "submit_answer") {
    if (session.request) return session;
    const question = [...session.transcript].reverse().find((turn) => turn.role === "coach");
    const text = action.text.trim();
    if (!question || !text) return session;
    return { ...session, transcript: [...session.transcript, { id: action.turnId, role: "writer", targetNodeId: question.targetNodeId, text, status: "pending" }], request: { turnId: action.turnId, targetNodeId: question.targetNodeId, status: "pending" }, lastError: null };
  }
  if (action.type === "request_failed") {
    if (!session.request) return session;
    return { ...session, transcript: session.transcript.map((turn) => turn.role === "writer" && turn.id === session.request?.turnId ? { ...turn, status: "failed" as const } : turn), request: { ...session.request, status: "failed", error: action.message }, lastError: action.message };
  }
  if (action.type === "retry_request") {
    if (session.request?.status !== "failed") return session;
    return { ...session, transcript: session.transcript.map((turn) => turn.role === "writer" && turn.id === session.request?.turnId ? { ...turn, status: "pending" as const } : turn), request: { ...session.request, status: "pending", error: undefined }, lastError: null };
  }
  try { return validateAndApplyThoughtResponse(session, action.response); }
  catch (error) { return thoughtDevelopmentReducer(session, { type: "request_failed", message: error instanceof Error ? error.message : "The Coach returned an invalid response" }); }
}

export function buildThoughtRequest(session: ThoughtDevelopmentSession) {
  if (!session.request || session.request.status !== "pending") throw new Error("No pending Thought Development request");
  if (!session.frontier.includes(session.request.targetNodeId)) throw new Error("target is not in the ready frontier");
  return { contract: "thought-development.v1" as const, sessionId: session.id, turnId: session.request.turnId, targetNodeId: session.request.targetNodeId, topic: session.topic, focus: session.focus, source: session.source, articleBoundary: session.articleBoundary, transcript: session.transcript, notes: session.notes, readiness: session.readiness };
}

export function hashArticleContent(content: unknown): string {
  const value = JSON.stringify(content); let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
