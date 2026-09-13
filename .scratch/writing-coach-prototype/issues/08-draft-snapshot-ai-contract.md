# Draft Snapshot AI contract and calibration cases

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 01, 03, 05

## Question

What structured AI output contract, prompt guidance, and compact set of calibration cases will reliably turn article evidence into the approved Draft Snapshot scores, confidence states, and explanations without penalizing early or intentionally unconventional writing?

## Comments

Prototype for review: [Draft Snapshot AI contract lab](../prototypes/08-draft-snapshot-ai-contract.html)

### Resolution — 2026-09-12

Use a versioned `draft-snapshot.v1` contract. Its request supplies the current Article revision, stable block IDs and text, word count, the Writer's stated purpose and audience, and applicable Coaching Context. Its response contains exactly one judgment for each of clarity, structure, concision, correctness, audience fit, and voice consistency.

Each category uses a discriminated assessment: either **scored** with an integer 1–5 score and low, medium, or high confidence, or **insufficient** with a null score and an insufficient confidence state. A scored judgment includes a concise pattern-to-reader-impact explanation and at least one hybrid evidence anchor (block ID, block-local offsets, and exact quote). When an unconventional pattern may be intentional and intent is unknown, the contract keeps the evidence-based score, lowers confidence, and permits one neutral intent question. Known intent changes the interpretation of the evidence but does not erase observable reader friction.

The response may select up to three Priorities from scored categories. Priority guidance identifies a Writer decision or improvement direction without supplying replacement prose. Application code—not the model—validates the contract version, echoed Article revision, category completeness, assessment invariants, and every evidence anchor against the live Article. It rejects the entire stale or malformed response. The application also derives the overall 0–100 score from the category scores, withholds it until at least four categories are assessable, and marks it provisional whenever a scored category has low confidence.

Prompt guidance must explicitly judge observed reader impact for the stated intent and audience; avoid grading effort, talent, completeness, or adherence to convention; never convert missing evidence into a low score; support scores with exact Article evidence; and preserve Writer ownership by coaching rather than rewriting.

The compact calibration set covers an early sketch, a mature draft with divergent category performance, an unexplained unconventional pattern, an intentional pattern with residual friction, and deterministic rejection of a stale evidence anchor. The Writer approved the interactive cases without requested changes.

Prototype: [Draft Snapshot AI contract lab](../prototypes/08-draft-snapshot-ai-contract.html)
Captured on branch: `prototype/draft-snapshot-ai-contract` at `605d328`
