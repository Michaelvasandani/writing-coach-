export const categories = ["clarity", "structure", "concision", "correctness", "audience-fit", "voice-consistency"] as const;
export type Category = (typeof categories)[number];

export type ArticleBlock = { id: string; type: string; text: string };
export type Anchor = { blockId: string; from: number; to: number; quote: string };

export type Suggestion = {
  id: string;
  scope: "passage" | "structural";
  category: Category;
  observation: string;
  readerImpact: string;
  direction: string;
  impact: "medium" | "high";
  confidence: "low" | "medium" | "high";
  anchors: Anchor[];
  intentQuestion?: string | null;
  status: "active" | "dismissed" | "withdrawn";
  createdAt: number;
};

export type SuggestionResponse = {
  dispositions: { suggestionId: string; action: "retain" | "revise" | "retire" }[];
  candidates: Suggestion[];
};

export type ThoughtNode = {
  id: ThoughtNodeId;
  label: string;
  required: boolean;
  prerequisites: ThoughtNodeId[];
};

export const thoughtNodeIds = ["central_point", "reasoning", "support", "reader_relevance", "structural_placement"] as const;
export type ThoughtNodeId = (typeof thoughtNodeIds)[number];
export type DevelopmentFocus = "thinking" | "structure" | "both";
export type DevelopmentReadinessState = "unresolved" | "addressed" | "skipped";
export type DevelopmentReadiness = Record<ThoughtNodeId, DevelopmentReadinessState>;

export type ThoughtSource =
  | { kind: "general" }
  | { kind: "passage"; text: string; blockId?: string; from: number; to: number }
  | { kind: "suggestion"; suggestionId: string; text: string }
  | { kind: "priority"; rank: number; text: string };

export type ThoughtArticleBoundary = { articleId: string; revision: number; contentHash: string };
export type ThoughtTranscriptTurn =
  | { id: string; role: "writer"; targetNodeId: ThoughtNodeId; text: string; status: "pending" | "failed" | "accepted" }
  | { id: string; role: "coach"; targetNodeId: ThoughtNodeId; text: string };
export type SessionNote = {
  id: string; role: ThoughtNodeId; text: string; sourceTurnIds: string[]; provenance: "coach-proposed" | "writer-edited";
  needsReview?: boolean;
};
export type ArticleShapeSection = { id: string; purpose: string; noteIds: string[] };
export type ArticleShape = { id: string; organizingLogic: string; tradeoff: string; sections: ArticleShapeSection[] };
export type ThoughtRequestState = {
  turnId: string; targetNodeId: ThoughtNodeId; status: "pending" | "failed"; error?: string;
};
export type ThoughtDevelopmentSession = {
  id: string; topic: string; focus: DevelopmentFocus; source: ThoughtSource; articleBoundary: ThoughtArticleBoundary;
  nodes: ThoughtNode[]; readiness: DevelopmentReadiness; frontier: ThoughtNodeId[]; transcript: ThoughtTranscriptTurn[];
  notes: SessionNote[]; shapes: ArticleShape[]; selectedShapeId: string | null; request: ThoughtRequestState | null; lastError: string | null;
  phase: "active" | "finished";
};
export type ProposedNoteChange =
  | { kind: "upsert"; note: SessionNote }
  | { kind: "delete"; noteId: string };
export type ThoughtNextAction =
  | { kind: "ask_question"; targetNodeId: ThoughtNodeId; question: string }
  | { kind: "offer_structures" }
  | { kind: "complete" };
export type ThoughtResponse = {
  contract: "thought-development.v1"; sessionId: string; turnId: string; targetNodeId: ThoughtNodeId;
  articleBoundary: ThoughtArticleBoundary; proposedNoteChanges: ProposedNoteChange[];
  readinessPatch: { nodeId: ThoughtNodeId; status: "addressed" | "skipped" }[]; nextAction: ThoughtNextAction;
};

export type SnapshotJudgment = {
  category: Category;
  state: "scored" | "insufficient";
  score: number | null;
  confidence: "low" | "medium" | "high" | "insufficient";
  explanation: string;
  anchors: Anchor[];
  intentQuestion?: string | null;
};

export type Priority = { rank: number; category: Category; guidance: string; why: string };
export type DraftSnapshot = {
  revision: number;
  judgments: SnapshotJudgment[];
  priorities: Priority[];
  overall: number | null;
  provisional: boolean;
  createdAt: number;
};
