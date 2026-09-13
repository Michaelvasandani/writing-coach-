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
  id: string;
  prompt: string;
  required: boolean;
  prerequisites: string[];
  status: "ready" | "blocked" | "answered" | "skipped";
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
