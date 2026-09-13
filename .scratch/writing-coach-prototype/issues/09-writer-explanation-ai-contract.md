# Writer Explanation AI contract and evaluation cases

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 01, 05

## Question

What structured AI request, response, prompt guidance, and compact evaluation cases will reliably apply passage-specific Writer Explanations and article-wide Coaching Context; report withdrawn, revised, and retained Suggestions; detect conflicts and uncertain applicability; and preserve reliable anchors through selective reassessment?

## Comments

### Prototype ready for Writer review — 2026-09-12

Drive the five guided edge cases and inspect the proposed request, response, prompt guidance, and ten-case evaluation set in [Writer Explanation AI contract prototype](../prototypes/09-writer-explanation-ai-contract.html).

This remains a human-in-the-loop decision. Record the Writer's reactions and resulting contract changes here before resolving the ticket.

### Resolution — 2026-09-12

Use one versioned Writer-reassessment contract. Its request carries the Article ID and revision, the trigger for reassessment, a hybrid target anchor (block ID, block-local offsets, exact quote), explicitly scoped Writer evidence, and the candidate Suggestions with their issue kinds. Passage explanations apply only to their anchored passage; article-wide Coaching Context applies only after the Writer explicitly selects that scope.

The schema-validated response must account for every candidate Suggestion exactly once as **retained**, **revised**, **withdrawn**, or **unchanged**, with a reason and the evidence applied. Revised Suggestions include replacement coaching; material uncertainty or conflicting context produces one concrete Writer question and blocks the affected outcomes rather than letting the model guess. Related Suggestions are reconsidered only when both their issue kind and relevant context match.

Before applying any result, the client validates the echoed request, Article revision, block ID, offsets, and exact quote against the live Article. A stale or ambiguous result is discarded and freshly analyzed. Material passage edits make passage context inactive until the Writer confirms that the same intentional choice still applies; deletion retires its passage context and Suggestions; replacing the Article clears all context. Reassessment may mark the Draft Snapshot outdated, but it never changes scores or Priorities without a requested fresh snapshot.

The compact evaluation set covers retention, revision, withdrawal, conflict escalation, selective relatedness, stale anchors, material edits, deletion and Article replacement, response completeness, and ownership of Snapshot and Priority changes. The Writer approved all five interactive walkthroughs without requested changes.

Prototype: [Writer Explanation AI contract](../prototypes/09-writer-explanation-ai-contract.html)
Captured on branch: `prototype/writer-explanation-ai-contract` at `7bf92b7`
