# 05 — Complete, copy, and discard a session safely

**What to build:** Let a Writer leave a partial or complete Thought-Development Session with useful copied material while making the temporary, non-coaching nature of that material unmistakable.

**Blocked by:** 02 — Collect Session Notes and show Development Readiness; 04 — Explore and revise temporary Article Shapes.

**Status:** resolved

- [x] A Writer can review a partial or complete Session before closing it.
- [x] Copy notes produces clean Markdown containing the topic, notes grouped by role, the selected Shape when present, and unresolved questions.
- [x] Copy transcript is a separate action and does not clutter the concise notes output.
- [x] Closing a Session with Writer answers or notes offers Copy and close, Close without copying, and Keep working.
- [x] Closing an empty Session does not show an unnecessary loss warning.
- [x] Copy and close copies exactly once and then discards the Session.
- [x] Closing or reloading leaves no transcript, Session Notes, Development Readiness, or Article Shapes in browser-local storage.
- [x] Suggestion and Draft Snapshot requests contain none of the discarded Session material.
- [x] The Article is byte-for-byte unchanged by Session completion, copying, closing, or reload.
- [x] Tests cover copied Markdown, transcript copying, all closing choices, reload disposal, critique isolation, and unchanged Article content.

## Comments

- Implemented on `codex/session-thought-ticket-05`. Verified with the full Vitest suite, TypeScript typecheck, and production build.
