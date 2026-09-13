# 03 — Launch Thought Development from Article context

**What to build:** Let a Writer begin the same temporary Thought-Development experience from a selected passage, Suggestion, or Priority while keeping the session topic visible and under Writer control.

**Blocked by:** 01 — Run a safe temporary Thought-Development Session.

**Status:** resolved

- [x] “Develop your ideas” remains available as the persistent general entry point.
- [x] A Writer can launch from a selected Article passage without changing that passage.
- [x] A Writer can launch from a Suggestion or Priority through a contextual action.
- [x] The setup step visibly identifies and prefills the contextual source.
- [x] The Writer can edit the proposed topic before the first Coach question.
- [x] Context is used only to focus questions and is never converted into invented Session Notes.
- [x] Stale or unavailable source context is detected before questioning begins and explained without opening a corrupted Session.
- [x] Tests cover all four entry paths and verify that the Article and coaching artifacts remain unchanged.

## Comments

### Implemented — 2026-09-12

Thought Development can now start from the persistent Coach action, a live Article selection, an active Suggestion, or a current Draft Snapshot Priority. Context is captured in transient launch state, shown separately from the editable topic, revalidated immediately before the first request, and passed only as request source context with an empty initial note set. Mounted coverage in `app/coach-workspace.test.tsx` verifies all entry paths, stale Priority rejection, and unchanged browser-local Article, Suggestion, and Snapshot data; dialog coverage verifies visible context and unavailable-source handling.
