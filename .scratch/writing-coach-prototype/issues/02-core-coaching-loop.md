# Core coaching loop interaction

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 01

## Question

Which concrete editor-and-Coach-Panel interaction best balances uninterrupted drafting with discoverable inline suggestions, three Priorities, a Draft Snapshot, structural help, and optional Thought-Development Sessions?

## Comments

### Prototype for review — 2026-09-12

Compare three interaction models in [Core coaching loop](../prototypes/02-core-coaching-loop.html):

- A — Quiet split workspace
- B — Editor-first Coach dock
- C — Guided revision passes

The arrow controls (or keyboard Left/Right outside the editor) switch variants. Try opening an inline suggestion, moving among Priorities/Suggestions/Snapshot, starting Thought Development, and editing the draft.

Captured on branch `prototype/core-coaching-loop` at `e8f3b87`.

### Resolution — 2026-09-12

Use **A — Quiet split workspace** as the core interaction model. Keep the editable Article as the dominant, centered surface and a stable-width Coach Panel persistently visible beside it. This preserves the Writer's place and makes coaching continuously discoverable without turning every pause into an interruption.

Paragraph analysis runs after a pause without moving focus. It adds quiet, type-distinguished inline marks; selecting a mark or its gutter count opens the matching Suggestion in the panel and highlights the passage. The Coach never changes prose automatically. A Suggestion explains the observed reader effect and offers **Explain my choice** and **Dismiss**; examples remain available only on explicit request.

Give the Coach Panel three stable top-level tabs:

- **Priorities** opens by default and shows exactly three ranked, article-level improvements plus an optional Thought-Development entry point.
- **Suggestions** holds passage-level and structural feedback, synchronized with inline marks. Structural feedback uses the same interaction rather than a separate editing mode.
- **Draft Snapshot** shows the explicit assessment, evidence sufficiency, and whether it is outdated. Priorities and scores change only when the Writer requests a refreshed Snapshot.

Launch Thought Development explicitly from relevant coaching, in a focused overlay that keeps the draft visible behind it. Ask one question at a time, use only Writer-supplied substance, and let the Writer leave and return to the unchanged draft at any point. For a blank or newly pasted Article, the same Coach Panel first gathers intent and audience, then settles into this coaching loop.
