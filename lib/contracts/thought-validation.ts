import type {
  ArticleShape,
  ArticleShapeResponse,
  DevelopmentFocus,
  DevelopmentReadiness,
  ProposedNoteChange,
  SessionNote,
  ThoughtArticleBoundary,
  ThoughtNode,
  ThoughtNodeId,
  ThoughtResponse,
  ThoughtTranscriptTurn
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

export function deriveThoughtFrontier(nodes: ThoughtNode[], readiness: DevelopmentReadiness, focus: DevelopmentFocus): ThoughtNodeId[] {
  const available = nodes.filter((node) => readiness[node.id] === "unresolved")
    .filter((node) => node.prerequisites.every((id) => readiness[id] !== "unresolved"))
    .map((node) => node.id);
  return focusOrder[focus].filter((id) => available.includes(id));
}

export function sameArticleBoundary(a: ThoughtArticleBoundary, b: ThoughtArticleBoundary) {
  return a.articleId === b.articleId && a.revision === b.revision && a.contentHash === b.contentHash;
}

export function isNeutralSingleQuestion(question: string): boolean {
  const normalized = question.trim();
  if (!normalized.endsWith("?") || (normalized.match(/\?/g) ?? []).length !== 1) return false;
  if (/[.!]\s+\S/.test(normalized.slice(0, -1))) return false;
  if (!/^(?:what|why|how|where|when|who|which|whose|can you|could you|in what|to what)\b/i.test(normalized)) return false;
  if (/\b(great|excellent|good|insightful|smart|strong|wonderful|nice|interesting|helpful|powerful|compelling|fascinating|exactly|right)\b/i.test(normalized)) return false;
  if (/\b(isn't|aren't|wouldn't|don't you (?:think|agree)|do you agree|would you say|surely|obviously|clearly|of course)\b/i.test(normalized)) return false;
  if (/^(?:since|because|given(?: that)?|as)\b/i.test(normalized)) return false;
  if (/\bor\b/i.test(normalized)) return false;
  if (/\band\s+(?:why|what|how|where|when|who|which|do|does|did|is|are|would|could|should)\b/i.test(normalized)) return false;
  return true;
}

function normalizedTokens(text: string) {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function isGroundedSessionNote(text: string, sourceText: string) {
  const noteTokens = normalizedTokens(text);
  const sourceTokens = normalizedTokens(sourceText);
  if (!noteTokens.length || noteTokens.length > sourceTokens.length) return false;
  for (let start = 0; start <= sourceTokens.length - noteTokens.length; start += 1) {
    if (noteTokens.every((token, index) => token === sourceTokens[start + index])) return true;
  }
  return false;
}

export function validateProposedNoteChanges(changes: ProposedNoteChange[], transcript: ThoughtTranscriptTurn[]) {
  const writerTurns = new Map(transcript.filter((turn) => turn.role === "writer").map((turn) => [turn.id, turn]));
  for (const change of changes) {
    if (change.kind === "delete") continue;
    if (change.note.provenance !== "coach-proposed") throw new Error("invalid Session Note provenance");
    if (!change.note.text.trim() || !change.note.sourceTurnIds.length || change.note.sourceTurnIds.some((id) => !writerTurns.has(id))) {
      throw new Error("invalid Session Note source");
    }
    const sourceText = change.note.sourceTurnIds.map((id) => writerTurns.get(id)?.text ?? "").join(" ");
    if (!isGroundedSessionNote(change.note.text, sourceText)) throw new Error("unsupported Session Note substance");
  }
}

export function canExploreFromNotes(notes: SessionNote[]) {
  const current = notes.filter((note) => !note.needsReview);
  return current.some((note) => note.role === "central_point")
    && current.filter((note) => note.role !== "central_point").length >= 2;
}

export type ThoughtResponseContext = {
  sessionId: string;
  request: { turnId: string; targetNodeId: ThoughtNodeId };
  articleBoundary: ThoughtArticleBoundary;
  nodes: ThoughtNode[];
  readiness: DevelopmentReadiness;
  frontier: ThoughtNodeId[];
  focus: DevelopmentFocus;
  transcript: ThoughtTranscriptTurn[];
  notes: SessionNote[];
};

export function validateThoughtResponse(context: ThoughtResponseContext, response: ThoughtResponse) {
  if (response.turnId !== context.request.turnId) throw new Error("stale turn identity");
  if (response.contract !== "thought-development.v1" || response.sessionId !== context.sessionId || response.targetNodeId !== context.request.targetNodeId) {
    throw new Error("stale Session identity");
  }
  if (!sameArticleBoundary(response.articleBoundary, context.articleBoundary)) throw new Error("Article boundary changed");
  if (!context.frontier.includes(context.request.targetNodeId)) throw new Error("target is not in the ready frontier");
  const writerTurn = context.transcript.find((turn) => turn.role === "writer" && turn.id === context.request.turnId);
  if (writerTurn) {
    if (response.readinessPatch.length > 1 || (response.readinessPatch[0] && response.readinessPatch[0].nodeId !== context.request.targetNodeId)) {
      throw new Error("invalid readiness transition");
    }
  } else if (response.readinessPatch.length) {
    throw new Error("opening question cannot change readiness");
  }

  const readiness = { ...context.readiness };
  for (const patch of response.readinessPatch) {
    if (readiness[patch.nodeId] !== "unresolved") throw new Error("invalid readiness transition");
    readiness[patch.nodeId] = patch.status;
  }
  const frontier = deriveThoughtFrontier(context.nodes, readiness, context.focus);
  validateProposedNoteChanges(response.proposedNoteChanges, context.transcript);
  const resultingNotes = response.proposedNoteChanges.reduce((notes, change) => {
    if (change.kind === "delete") return notes.filter((note) => note.id !== change.noteId || note.provenance === "writer-edited");
    const index = notes.findIndex((note) => note.id === change.note.id);
    if (index >= 0 && notes[index].provenance === "writer-edited") return notes;
    const next = [...notes];
    const note = { ...change.note, needsReview: false };
    if (index >= 0) next[index] = note; else next.push(note);
    return next;
  }, context.notes);

  if (response.nextAction.kind === "ask_question") {
    if (!frontier.includes(response.nextAction.targetNodeId)) throw new Error("next question does not target the ready frontier");
    if (!isNeutralSingleQuestion(response.nextAction.question)) throw new Error("question must be one neutral question");
  } else if (response.nextAction.kind === "offer_structures") {
    if (context.focus === "thinking") throw new Error("Article Shape exploration does not match the Development Focus");
    if (!frontier.length || !canExploreFromNotes(resultingNotes)) throw new Error("Article Shape exploration is not suitable yet");
  } else if (context.nodes.some((node) => node.required && readiness[node.id] === "unresolved")) {
    throw new Error("Session is not complete");
  }
  return { readiness, frontier };
}

const shapeVocabulary = new Set([
  "arrange", "arrangement", "arrives", "begin", "central", "compare", "concrete", "connect", "contrast", "delay", "delayed",
  "describe", "develop", "emphasis", "emphasize", "emphasizes", "example", "explain", "frame", "introduce", "last", "lead", "logic",
  "main", "move", "naming", "order", "organize", "point", "present", "reason", "reasoning", "section", "state", "structure", "support", "then", "tradeoff", "the", "to", "its", "it", "is", "with", "from", "after", "before", "and"
]);

function validateShape(shape: ArticleShape, noteIds: Set<string>, noteText: string) {
  const sectionIds = new Set<string>();
  const usedNoteIds = new Set<string>();
  if (!shape.id.trim() || !shape.organizingLogic.trim() || !shape.tradeoff.trim() || !shape.sections.length) throw new Error("invalid Article Shape");
  for (const section of shape.sections) {
    if (!section.id.trim() || sectionIds.has(section.id) || !section.purpose.trim() || section.purpose.length > 80 || !section.noteIds.length) throw new Error("invalid Article Shape section");
    sectionIds.add(section.id);
    for (const noteId of section.noteIds) {
      if (!noteIds.has(noteId)) throw new Error("Article Shapes must reference current Session Notes");
      if (usedNoteIds.has(noteId)) throw new Error("a Session Note can appear only once in an Article Shape");
      usedNoteIds.add(noteId);
    }
  }
  const noteTokens = new Set(normalizedTokens(noteText));
  const metadata = [shape.organizingLogic, shape.tradeoff, ...shape.sections.map((section) => section.purpose)].join(" ");
  if (!normalizedTokens(metadata).every((token) => noteTokens.has(token) || shapeVocabulary.has(token))) throw new Error("unsupported Article Shape substance");
}

export type ArticleShapeResponseContext = {
  sessionId: string;
  requestId: string;
  articleBoundary: ThoughtArticleBoundary;
  frontier: ThoughtNodeId[];
  notes: SessionNote[];
};

export function validateArticleShapeResponse(context: ArticleShapeResponseContext, response: ArticleShapeResponse) {
  if (response.requestId !== context.requestId) throw new Error("stale Article Shape request");
  if (response.contract !== "thought-development.v1" || response.sessionId !== context.sessionId) throw new Error("stale Session identity");
  if (!sameArticleBoundary(response.articleBoundary, context.articleBoundary)) throw new Error("Article boundary changed");
  if (response.kind === "unresolved") {
    if (!context.frontier.includes(response.unresolvedArea)) throw new Error("follow-up does not target the ready frontier");
    if (!isNeutralSingleQuestion(response.question)) throw new Error("follow-up must be one neutral question");
    return;
  }
  if (!canExploreFromNotes(context.notes)) throw new Error("current Session Notes are not sufficient for Article Shapes");
  if (!response.shapes.length || response.shapes.length > 3) throw new Error("Article Shape responses must contain one to three Shapes");
  const shapeIds = new Set<string>();
  const notes = context.notes.filter((note) => !note.needsReview);
  const noteIds = new Set(notes.map((note) => note.id));
  for (const shape of response.shapes) {
    if (shapeIds.has(shape.id)) throw new Error("Article Shape IDs must be unique");
    shapeIds.add(shape.id);
    validateShape(shape, noteIds, notes.map((note) => note.text).join(" "));
  }
}
