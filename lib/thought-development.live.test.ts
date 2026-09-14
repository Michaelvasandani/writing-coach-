import { describe, expect, it } from "vitest";
import { thoughtInstructions, thoughtOutputSchema } from "@/lib/contracts/thought";
import { isGroundedSessionNote } from "@/lib/contracts/thought-validation";
import { runContract } from "@/lib/server/ai";
import {
  buildThoughtRequest,
  createThoughtDevelopmentSession,
  thoughtDevelopmentReducer,
  validateAndApplyThoughtResponse
} from "@/lib/thought-development";
import type { ThoughtNodeId } from "@/lib/types";

const liveEnabled = process.env.RUN_THOUGHT_LIVE_SMOKE === "1" && Boolean(process.env.AI_GATEWAY_API_KEY);

describe.skipIf(!liveEnabled)("live Thought-Development Coaching Contract", () => {
  it("completes a schema-valid Session without adding substance to Session Notes", { timeout: 180_000 }, async () => {
    const boundary = { articleId: "live-smoke-article", revision: 1, contentHash: "live-smoke-boundary" };
    let session = createThoughtDevelopmentSession({
      id: "live-smoke-session",
      topic: "Why public libraries matter for studying",
      focus: "thinking",
      articleBoundary: boundary,
      requestId: "live-opening"
    });

    const answerByNode: Record<ThoughtNodeId, string> = {
      central_point: "Public libraries give people a quiet place to study.",
      reasoning: "A quiet place helps people concentrate when home is crowded.",
      support: "During college I studied at the library because my apartment was crowded.",
      reader_relevance: "Readers should notice that access to quiet space is uneven.",
      structural_placement: "I want the article to state the point, explain the reason, give my college example, and end with uneven access."
    };

    const opening = await runContract(thoughtOutputSchema, thoughtInstructions, buildThoughtRequest(session), "THOUGHT_MODEL", "openai/gpt-5.6-luna");
    session = validateAndApplyThoughtResponse(session, opening);

    for (let turn = 1; turn <= 15 && session.phase === "active"; turn += 1) {
      const question = [...session.transcript].reverse().find((item) => item.role === "coach");
      expect(question).toBeDefined();
      session = thoughtDevelopmentReducer(session, {
        type: "submit_answer",
        turnId: `live-writer-${turn}`,
        text: answerByNode[question!.targetNodeId]
      });
      const output = await runContract(thoughtOutputSchema, thoughtInstructions, buildThoughtRequest(session), "THOUGHT_MODEL", "openai/gpt-5.6-luna");
      session = validateAndApplyThoughtResponse(session, output);
    }

    expect(session.phase).toBe("finished");
    expect(Object.values(session.readiness)).not.toContain("unresolved");
    for (const note of session.notes) {
      const source = session.transcript
        .filter((turn) => turn.role === "writer" && note.sourceTurnIds.includes(turn.id))
        .map((turn) => turn.text)
        .join(" ");
      expect(note.provenance).toBe("coach-proposed");
      expect(isGroundedSessionNote(note.text, source)).toBe(true);
    }
  });
});
