# Thought-Development Session AI contract

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 02, 04, 05

## Question

What structured state, prompt guidance, response contract, and compact evaluation cases will make an optional Thought-Development Session ask one useful question at a time, follow prerequisite-aware lines of inquiry, use only Writer-supplied substance, recognize completion, and return the Writer to an unchanged draft with a faithful summary of their thinking?

## Comments

### Prototype ready for Writer review — 2026-09-12

Drive the six guided edge cases and inspect the proposed persistent state, request/response contract, prompt guidance, deterministic validation rules, and twelve-case evaluation set in [Thought-Development Session AI contract prototype](../prototypes/11-thought-development-ai-contract.html).

This is a human-in-the-loop decision. Record the Writer's reactions and resulting contract changes here before resolving the ticket.

## Answer

### Resolution — 2026-09-12

Use a versioned `thought-development.v1` Coaching Contract whose persistent state is owned and validated by the application. State contains the selected rough thought, an immutable Article boundary (Article ID, start revision, content hash, and selection), a decision tree of required or optional nodes with explicit prerequisites, source-linked atomic notes extracted from Writer turns, the recomputed frontier, and at most one open Coach question.

The model may propose a narrowly scoped dependent node when a Writer answer exposes a new line of inquiry, but the client decides whether that node is valid, remains within the selected thought, and has satisfiable prerequisites. Each turn request supplies the current validated state and Article boundary. Each response is schema-discriminated as exactly one **question**, **state patch**, or **completion request**. A question must target one ready frontier node and contain exactly one neutral question—no suggested answers, bundled questions, leading premises, praise, or replacement prose.

Every substantive note must be entailed by a Writer turn and cite that turn's ID. Ambiguous, contradictory, or "I don't know" answers never authorize the Coach to fill a gap: it asks one narrower question on the same node, preserves conflicting notes for clarification, or lets the Writer explicitly skip. A skipped node satisfies dependency traversal so the Session can advance, while remaining visible as a gap in state and in the return package.

The application—not the model—applies patches, recomputes the frontier, and evaluates completion. Completion succeeds only when every required node is answered or explicitly skipped and none remains ready or blocked. The Writer may exit earlier at any time. Normal completion returns a faithful summary whose claims cite active note IDs; early exit returns the same structure marked partial. Both report unresolved tensions, skipped gaps, and any remaining frontier without converting the notes into publishable prose.

The Session never emits Article edits. Its return package echoes the starting Article revision, content hash, and selection; the client restores focus only when those values still match, otherwise it blocks restoration for reconciliation. Deterministic validation also rejects mismatched contract/session/turn IDs, multiple questions, non-frontier targets, unsupported notes, invalid topology changes, false completion, summary claims without source notes, and Article-boundary drift.

The approved compact evaluation set covers single-question cadence, prerequisite order, Writer-only substance, ambiguity, contradiction, explicit skipping, newly surfaced branches, premature and valid completion, faithful source-linked summaries, early exit, Article integrity, and prompt-injection resistance. The Writer approved the client-owned state model, narrow model-proposed nodes, skip-to-unblock semantics with disclosed gaps, deterministic completion, and unchanged-Article return without requested changes.

Prototype: [Thought-Development Session AI contract](../prototypes/11-thought-development-ai-contract.html)
Captured on branch: `prototype/thought-development-ai-contract` at `58f3378`
