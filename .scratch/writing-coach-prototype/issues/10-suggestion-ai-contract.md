# Paragraph and structural Suggestion AI contract

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 01, 02, 05

## Question

What structured request, response, prompt guidance, and compact evaluation cases will reliably turn a paused paragraph plus Article context into well-anchored clarity, concision, correctness, audience-fit, and structural Suggestions that explain reader impact, preserve authorship, avoid duplicates, and feed exactly three Draft Priorities without interrupting drafting?

## Comments

Prototype for review: [Suggestion AI contract lab](../prototypes/10-suggestion-ai-contract.html)

The lab exercises quiet changed-block analysis, multi-anchor structural analysis, explicit retain/revise/retire dispositions, duplicate and dismissal suppression, stale-response rejection, uncertain intentionality, active-feedback caps, and the boundary that only a requested Draft Snapshot may select up to three Priorities.

## Answer

### Resolution — 2026-09-12

Use one versioned `suggestion-analysis.v1` Coaching Contract with two explicit modes. A quiet paragraph pause invokes `changed_block`; its request supplies the complete 500–2,000-word Article, marks the changed block, and may return zero to two Passage Suggestions anchored in that block. An explicitly requested Draft Snapshot refresh invokes `whole_article`; it may return zero to three Structural Suggestions, each supported by at least two ordered passage anchors. Structural scope is independent of category, so a cross-paragraph clarity problem remains a clarity Suggestion with structural scope.

Both requests include the Article ID and revision, stable block IDs and text, Writer purpose and audience, applicable Coaching Context, affected active Suggestions, and dismissal records. The response echoes the request identity, mode, and Article revision. It gives exactly one `retain`, `revise`, or `retire` disposition for every affected active Suggestion, followed by bounded new candidates. Each candidate contains scope; one of clarity, structure, concision, correctness, audience fit, or voice consistency; medium or high reader impact; low, medium, or high confidence; an observation; reader impact; an improvement direction; an optional intent question; and hybrid evidence anchors using block ID, block-local offsets, and exact quote.

The model judges reader impact and proposes dispositions. Deterministic application code validates the entire response atomically, rejects stale or invented anchors, assigns stable IDs, applies lifecycle changes, and suppresses duplicates. For the prototype, a duplicate group is the same category, scope, and anchored region. A dismissed group remains suppressed until its source passage, relevant structural evidence, or Coaching Context changes materially. Keep no more than five active Passage Suggestions and three active Structural Suggestions, ranked by reader impact, confidence, then recency. Prefer silence to low-impact, repetitive, or unactionable feedback.

Every Suggestion explains observation → reader impact → improvement direction and begins with guidance rather than replacement prose. It may ask one neutral intent question only when confidence is low and observable friction remains; the question appears only when the Writer opens the Suggestion. Correctness covers internal inconsistency, meaning-changing usage, and claims that may need verification, not unsupported assertions of external truth. Examples remain a separate, explicitly requested interaction.

Suggestion analysis never changes Draft Snapshot scores or Priorities. Active Suggestions may be supplied as secondary evidence to the next explicitly requested Draft Snapshot, but that contract must re-evaluate the Article evidence and remains the sole authority for selecting zero to three meaningful Priorities. This supersedes the earlier literal “exactly three” wording: the Coach never invents a weak Priority to fill a slot.

The approved compact evaluation set covers valid silence, per-mode candidate limits, multi-anchor structural evidence, complete lifecycle dispositions, duplicate suppression, dismissal recurrence after material change, uncertain intentionality without interruption, the correctness boundary, authorship preservation, atomic stale-response rejection, the eight-item active cap, and the separate Priority authority.

Prototype: [Suggestion AI contract lab](../prototypes/10-suggestion-ai-contract.html)
Captured on branch: `prototype/suggestion-ai-contract` at `64c3ebb`
