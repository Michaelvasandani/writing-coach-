# 01 — Run a safe temporary Thought-Development Session

**What to build:** Let a Writer open “Develop your ideas,” provide or edit a topic, choose a Development Focus, and begin a temporary Thought-Development Session that asks one valid neutral question at a time without changing the Article.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The setup step accepts a topic and one focus: develop thinking, find a structure, or both.
- [x] The Session captures its starting Article boundary and keeps the visible Article read-only and unchanged.
- [x] The application owns a prerequisite-aware development tree and sends only a ready frontier target on each turn.
- [x] A validated turn applies readiness changes and exactly one next action atomically.
- [x] Questions are neutral, contain no suggested answers or praise, and ask exactly one thing.
- [x] A malformed or stale response changes no Session state and presents a recoverable error.
- [x] A failed request retains the Writer's submitted answer, and retry with stable identity creates no duplicate message.
- [x] Session state is excluded from the browser-local Article record.
- [x] Automated tests drive the visible setup and first successful and failed Q&A turns.

## Comments

### Implemented — 2026-09-12

The temporary Session now has a client-owned domain model, prerequisite-derived frontier, atomic response validator, stable retry identity, and an editable setup step. The dialog holds all Session state outside the browser-local Article record, and its parent locks every Article mutation surface while the dialog is open. Contract and mounted-dialog coverage live in `lib/thought-development.test.ts` and `app/thought-development-dialog.test.tsx`.
