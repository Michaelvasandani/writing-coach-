import type {
  ArticleShape, ArticleShapeResponse, DevelopmentFocus, DevelopmentReadiness, ProposedNoteChange, ThoughtArticleBoundary, ThoughtDevelopmentSession,
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
    nodes, readiness, frontier, transcript: [], notes: [], shapes: [], selectedShapeId: null, shapeRequest: null, shapeIssue: null, phase: "active",
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

const groundingStopWords = new Set(["about", "after", "again", "also", "because", "before", "being", "could", "does", "from", "have", "into", "more", "most", "only", "other", "should", "their", "there", "these", "they", "this", "those", "through", "very", "what", "when", "where", "which", "while", "with", "would"]);
const shapeVocabulary = new Set([
  "arrange", "arrangement", "arrives", "begin", "central", "compare", "concrete", "connect", "contrast", "delay", "delayed",
  "describe", "develop", "emphasis", "emphasize", "emphasizes", "example", "explain", "frame", "introduce", "last", "lead", "logic",
  "main", "move", "naming", "order", "organize", "point", "present", "reason", "reasoning", "section", "state", "structure", "support", "then", "tradeoff"
]);

function groundingTokens(text: string) {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((token) => token.length > 3 && !groundingStopWords.has(token)) ?? [];
}

function isGroundedNote(text: string, sourceText: string) {
  const noteTokens = groundingTokens(text);
  if (!noteTokens.length) return sourceText.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase());
  const sourceTokens = new Set(groundingTokens(sourceText));
  const grounded = noteTokens.filter((token) => sourceTokens.has(token)).length;
  return grounded / noteTokens.length >= 0.7;
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
    const sourceText = session.transcript.filter((turn) => turn.role === "writer" && change.note.sourceTurnIds.includes(turn.id)).map((turn) => turn.text).join(" ");
    if (!isGroundedNote(change.note.text, sourceText)) throw new Error("unsupported Session Note substance");
    const index = notes.findIndex((note) => note.id === change.note.id);
    if (index >= 0 && notes[index].provenance === "writer-edited") continue;
    const note = { ...change.note, text: change.note.text.trim(), sourceTurnIds: [...change.note.sourceTurnIds], provenance: "coach-proposed" as const, needsReview: false };
    if (index >= 0) notes[index] = note; else notes.push(note);
  }
  return notes;
}

export function editSessionNote(session: ThoughtDevelopmentSession, noteId: string, text: string): ThoughtDevelopmentSession {
  const nextText = text.trim();
  if (!nextText) return session;
  const notes = session.notes.map((note) => note.id === noteId
    ? { ...note, text: nextText, provenance: "writer-edited" as const, needsReview: false }
    : note);
  return notes.some((note, index) => note !== session.notes[index]) ? { ...session, notes } : session;
}

export function deleteSessionNote(session: ThoughtDevelopmentSession, noteId: string): ThoughtDevelopmentSession {
  const notes = session.notes.filter((note) => note.id !== noteId);
  if (notes.length === session.notes.length) return session;
  const shapes = session.shapes.map((shape) => ({
    ...shape,
    sections: shape.sections.map((section) => ({ ...section, noteIds: section.noteIds.filter((id) => id !== noteId) }))
  }));
  return { ...session, notes, shapes };
}

function dependentNodeIds(session: ThoughtDevelopmentSession, nodeId: ThoughtNodeId) {
  const affected = new Set<ThoughtNodeId>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of session.nodes) {
      if (!affected.has(node.id) && node.prerequisites.some((id) => affected.has(id))) {
        affected.add(node.id);
        changed = true;
      }
    }
  }
  return affected;
}

export function reviseThoughtAnswer(session: ThoughtDevelopmentSession, turnId: string, text: string): ThoughtDevelopmentSession {
  const nextText = text.trim();
  const turnIndex = session.transcript.findIndex((turn) => turn.role === "writer" && turn.id === turnId);
  const turn = session.transcript[turnIndex];
  if (!nextText || !turn || turn.role !== "writer" || session.request) return session;
  const affectedNodes = dependentNodeIds(session, turn.targetNodeId);
  const affectedTurnIds = new Set(session.transcript.filter((item) => item.role === "writer" && affectedNodes.has(item.targetNodeId)).map((item) => item.id));
  const transcript = session.transcript.slice(0, turnIndex + 1).map((item) => item.id === turnId
    ? { ...item, text: nextText, status: "pending" as const }
    : item);
  const notes = session.notes.flatMap((note) => {
    if (!note.sourceTurnIds.some((id) => affectedTurnIds.has(id))) return [note];
    return note.provenance === "writer-edited" ? [{ ...note, needsReview: true }] : [];
  });
  const readiness = { ...session.readiness };
  for (const nodeId of affectedNodes) readiness[nodeId] = "unresolved";
  return {
    ...session, transcript, notes, readiness, frontier: deriveThoughtFrontier(session.nodes, readiness, session.focus), shapes: [], selectedShapeId: null,
    request: { turnId, targetNodeId: turn.targetNodeId, status: "pending" }, shapeIssue: null, lastError: null, phase: "active"
  };
}

export function skipThoughtNode(session: ThoughtDevelopmentSession, turnId: string): ThoughtDevelopmentSession {
  if (session.request || session.phase !== "active") return session;
  const question = [...session.transcript].reverse().find((turn) => turn.role === "coach");
  if (!question || session.readiness[question.targetNodeId] !== "unresolved") return session;
  const readiness = { ...session.readiness, [question.targetNodeId]: "skipped" as const };
  const frontier = deriveThoughtFrontier(session.nodes, readiness, session.focus);
  if (!frontier.length) return { ...session, readiness, frontier, phase: "finished" };
  return { ...session, readiness, frontier, request: { turnId, targetNodeId: frontier[0], status: "pending" }, lastError: null };
}

export function updateDevelopmentFocus(session: ThoughtDevelopmentSession, focus: DevelopmentFocus): ThoughtDevelopmentSession {
  return { ...session, focus, frontier: deriveThoughtFrontier(session.nodes, session.readiness, focus) };
}

export function finishThoughtDevelopment(session: ThoughtDevelopmentSession): ThoughtDevelopmentSession {
  return { ...session, phase: "finished", request: null, lastError: null };
}

export function isThoughtCheckpoint(questionCount: number) {
  return questionCount >= 5 && (questionCount - 5) % 3 === 0;
}

function currentShapeNotes(session: ThoughtDevelopmentSession) {
  return session.notes.filter((note) => !note.needsReview);
}

export function canExploreArticleShapes(session: ThoughtDevelopmentSession) {
  const notes = currentShapeNotes(session);
  return notes.some((note) => note.role === "central_point")
    && notes.filter((note) => note.role !== "central_point").length >= 2;
}

export function beginArticleShapeExploration(session: ThoughtDevelopmentSession, requestId: string): ThoughtDevelopmentSession {
  if (!requestId || session.request || session.shapeRequest) return session;
  return { ...session, shapeRequest: { requestId, status: "pending" }, shapeIssue: null, lastError: null };
}

export function failArticleShapeRequest(session: ThoughtDevelopmentSession, message: string): ThoughtDevelopmentSession {
  if (!session.shapeRequest) return session;
  return {
    ...session,
    shapeRequest: { ...session.shapeRequest, status: "failed", error: message },
    lastError: message
  };
}

export function retryArticleShapeRequest(session: ThoughtDevelopmentSession): ThoughtDevelopmentSession {
  if (session.shapeRequest?.status !== "failed") return session;
  return { ...session, shapeRequest: { requestId: session.shapeRequest.requestId, status: "pending" }, lastError: null };
}

export function buildArticleShapeRequest(session: ThoughtDevelopmentSession) {
  if (!session.shapeRequest || session.shapeRequest.status !== "pending") throw new Error("No pending Article Shape request");
  return {
    contract: "thought-development.v1" as const,
    requestKind: "explore_structures" as const,
    sessionId: session.id,
    requestId: session.shapeRequest.requestId,
    topic: session.topic,
    focus: session.focus,
    articleBoundary: session.articleBoundary,
    notes: currentShapeNotes(session).map((note) => ({ ...note, sourceTurnIds: [...note.sourceTurnIds] })),
    readiness: { ...session.readiness }
  };
}

function validateShape(shape: ArticleShape, noteIds: Set<string>) {
  const shapeSectionIds = new Set<string>();
  const usedNoteIds = new Set<string>();
  if (!shape.id.trim() || !shape.organizingLogic.trim() || !shape.tradeoff.trim() || !shape.sections.length) throw new Error("invalid Article Shape");
  for (const section of shape.sections) {
    if (!section.id.trim() || shapeSectionIds.has(section.id) || !section.purpose.trim() || section.purpose.length > 80 || !section.noteIds.length) {
      throw new Error("invalid Article Shape section");
    }
    shapeSectionIds.add(section.id);
    for (const noteId of section.noteIds) {
      if (!noteIds.has(noteId)) throw new Error("Article Shapes must reference current Session Notes");
      if (usedNoteIds.has(noteId)) throw new Error("a Session Note can appear only once in an Article Shape");
      usedNoteIds.add(noteId);
    }
  }
}

function isGroundedShapeMetadata(shape: ArticleShape, noteText: string) {
  const noteTokens = new Set(groundingTokens(noteText));
  const metadata = [shape.organizingLogic, shape.tradeoff, ...shape.sections.map((section) => section.purpose)].join(" ");
  return groundingTokens(metadata).every((token) => noteTokens.has(token) || shapeVocabulary.has(token));
}

export function applyArticleShapeResponse(session: ThoughtDevelopmentSession, response: ArticleShapeResponse): ThoughtDevelopmentSession {
  const pending = session.shapeRequest;
  if (!pending || pending.status !== "pending" || response.requestId !== pending.requestId) throw new Error("stale Article Shape request");
  if (response.contract !== "thought-development.v1" || response.sessionId !== session.id) throw new Error("stale Session identity");
  if (!sameBoundary(response.articleBoundary, session.articleBoundary)) throw new Error("Article boundary changed");

  if (response.kind === "unresolved") {
    if (!isNeutralSingleQuestion(response.question)) throw new Error("follow-up must be one neutral question");
    const readiness = { ...session.readiness, [response.unresolvedArea]: "unresolved" as const };
    const questionId = `coach-shape-${response.requestId}`;
    return {
      ...session,
      readiness,
      frontier: deriveThoughtFrontier(session.nodes, readiness, session.focus),
      transcript: [...session.transcript, { id: questionId, role: "coach", targetNodeId: response.unresolvedArea, text: response.question }],
      shapes: [],
      selectedShapeId: null,
      shapeRequest: null,
      shapeIssue: { unresolvedArea: response.unresolvedArea, question: response.question },
      phase: "active",
      lastError: null
    };
  }

  if (!canExploreArticleShapes(session)) throw new Error("current Session Notes are not sufficient for Article Shapes");
  if (!response.shapes.length || response.shapes.length > 3) throw new Error("Article Shape responses must contain one to three Shapes");
  const shapeIds = new Set<string>();
  const currentNotes = currentShapeNotes(session);
  const noteIds = new Set(currentNotes.map((note) => note.id));
  for (const shape of response.shapes) {
    if (shapeIds.has(shape.id)) throw new Error("Article Shape IDs must be unique");
    shapeIds.add(shape.id);
    validateShape(shape, noteIds);
    if (!isGroundedShapeMetadata(shape, currentNotes.map((note) => note.text).join(" "))) throw new Error("unsupported Article Shape substance");
  }
  const shapes = response.shapes.map((shape) => ({
    ...shape,
    organizingLogic: shape.organizingLogic.trim(),
    tradeoff: shape.tradeoff.trim(),
    sections: shape.sections.map((section) => ({ ...section, purpose: section.purpose.trim(), noteIds: [...section.noteIds] }))
  }));
  return { ...session, shapes, selectedShapeId: shapes[0]?.id ?? null, shapeRequest: null, shapeIssue: null, lastError: null };
}

function updateShape(session: ThoughtDevelopmentSession, shapeId: string, update: (shape: ArticleShape) => ArticleShape): ThoughtDevelopmentSession {
  if (!session.shapes.some((shape) => shape.id === shapeId)) return session;
  return { ...session, shapes: session.shapes.map((shape) => shape.id === shapeId ? update(shape) : shape) };
}

export function selectArticleShape(session: ThoughtDevelopmentSession, shapeId: string): ThoughtDevelopmentSession {
  return session.shapes.some((shape) => shape.id === shapeId) ? { ...session, selectedShapeId: shapeId } : session;
}

export function renameShapeSection(session: ThoughtDevelopmentSession, shapeId: string, sectionId: string, purpose: string): ThoughtDevelopmentSession {
  const nextPurpose = purpose.trim();
  if (!nextPurpose) return session;
  return updateShape(session, shapeId, (shape) => ({
    ...shape,
    sections: shape.sections.map((section) => section.id === sectionId ? { ...section, purpose: nextPurpose } : section)
  }));
}

export function reorderShapeSection(session: ThoughtDevelopmentSession, shapeId: string, sectionId: string, direction: "up" | "down"): ThoughtDevelopmentSession {
  return updateShape(session, shapeId, (shape) => {
    const index = shape.sections.findIndex((section) => section.id === sectionId);
    const destination = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || destination < 0 || destination >= shape.sections.length) return shape;
    const sections = shape.sections.map((section) => ({ ...section, noteIds: [...section.noteIds] }));
    [sections[index], sections[destination]] = [sections[destination], sections[index]];
    return { ...shape, sections };
  });
}

export function moveShapeNote(session: ThoughtDevelopmentSession, shapeId: string, noteId: string, toSectionId: string): ThoughtDevelopmentSession {
  if (!session.notes.some((note) => note.id === noteId)) return session;
  return updateShape(session, shapeId, (shape) => {
    if (!shape.sections.some((section) => section.id === toSectionId)) return shape;
    return {
      ...shape,
      sections: shape.sections.map((section) => ({
        ...section,
        noteIds: section.id === toSectionId
          ? [...section.noteIds.filter((id) => id !== noteId), noteId]
          : section.noteIds.filter((id) => id !== noteId)
      }))
    };
  });
}

export function removeShapeNote(session: ThoughtDevelopmentSession, shapeId: string, noteId: string): ThoughtDevelopmentSession {
  return updateShape(session, shapeId, (shape) => ({
    ...shape,
    sections: shape.sections.map((section) => ({ ...section, noteIds: section.noteIds.filter((id) => id !== noteId) }))
  }));
}

function markdownLine(text: string) {
  return text.trim().replace(/\s*\n+\s*/g, " ");
}

export function formatSessionNotesMarkdown(session: ThoughtDevelopmentSession): string {
  const sections: string[] = [`# ${markdownLine(session.topic)}`, "## Session Notes"];
  const notesByRole = new Map<ThoughtNodeId, string[]>();
  for (const note of session.notes) {
    const notes = notesByRole.get(note.role) ?? [];
    notes.push(markdownLine(note.text));
    notesByRole.set(note.role, notes);
  }
  for (const node of session.nodes) {
    const notes = notesByRole.get(node.id);
    if (notes?.length) sections.push(`### ${node.label}\n\n${notes.map((note) => `- ${note}`).join("\n")}`);
  }
  if (!session.notes.length) sections.push("_No Session Notes._");

  const selectedShape = session.shapes.find((shape) => shape.id === session.selectedShapeId);
  if (selectedShape) {
    const noteTextById = new Map(session.notes.map((note) => [note.id, markdownLine(note.text)]));
    const shapeLines = selectedShape.sections.map((section, index) => {
      const noteLines = section.noteIds.flatMap((noteId) => {
        const text = noteTextById.get(noteId);
        return text ? [`   - ${text}`] : [];
      });
      return [`${index + 1}. **${markdownLine(section.purpose)}**`, ...noteLines].join("\n");
    });
    sections.push(`## Selected Article Shape\n\n_${markdownLine(selectedShape.organizingLogic)}_\n\n${shapeLines.join("\n")}\n\nTradeoff: ${markdownLine(selectedShape.tradeoff)}`);
  }

  const unanswered = session.nodes.filter((node) => session.readiness[node.id] === "unresolved");
  if (unanswered.length) {
    const latestQuestions = new Map<ThoughtNodeId, string>();
    for (const turn of session.transcript) {
      if (turn.role === "coach") latestQuestions.set(turn.targetNodeId, markdownLine(turn.text));
    }
    sections.push(`## Unresolved Questions\n\n${unanswered.map((node) => `- **${node.label}:** ${latestQuestions.get(node.id) ?? "Not yet explored."}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

export function formatThoughtTranscriptMarkdown(session: ThoughtDevelopmentSession): string {
  const turns = session.transcript.map((turn) => `**${turn.role === "coach" ? "Coach" : "Writer"}:** ${markdownLine(turn.text)}`);
  return [`# Thought-Development Transcript`, `## ${markdownLine(session.topic)}`, ...turns].join("\n\n");
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
  return {
    ...session,
    readiness,
    frontier,
    notes,
    transcript,
    request: null,
    lastError: null,
    phase: response.nextAction.kind === "complete" ? "finished" : session.phase
  };
}

export type ThoughtDevelopmentAction =
  | { type: "submit_answer"; turnId: string; text: string }
  | { type: "request_failed"; message: string }
  | { type: "retry_request" }
  | { type: "response_received"; response: ThoughtResponse };

export function thoughtDevelopmentReducer(session: ThoughtDevelopmentSession, action: ThoughtDevelopmentAction): ThoughtDevelopmentSession {
  if (action.type === "submit_answer") {
    if (session.request || session.shapeRequest) return session;
    const question = [...session.transcript].reverse().find((turn) => turn.role === "coach");
    const text = action.text.trim();
    if (!question || !text) return session;
    return { ...session, transcript: [...session.transcript, { id: action.turnId, role: "writer", targetNodeId: question.targetNodeId, text, status: "pending" }], request: { turnId: action.turnId, targetNodeId: question.targetNodeId, status: "pending" }, shapeIssue: null, lastError: null };
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
