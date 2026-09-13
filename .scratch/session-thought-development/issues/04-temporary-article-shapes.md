# 04 — Explore and revise temporary Article Shapes

**What to build:** Let a Writer explicitly compare and adapt up to three temporary ways of organizing their own Session Notes, without receiving generated Article prose.

**Blocked by:** 02 — Collect Session Notes and show Development Readiness.

**Status:** resolved

- [x] Explore structures becomes available only after a central-point note and at least two supporting notes exist.
- [x] Requesting structures with insufficient or contradictory notes yields the exact unresolved area and one neutral follow-up question.
- [x] A successful request returns no more than three Article Shapes grounded exclusively in current Session Notes.
- [x] Each Shape presents ordered section purposes, referenced notes, organizing logic, and a concise tradeoff.
- [x] Shapes contain no invented claim, example, evidence, polished heading, or Article prose.
- [x] The Writer can select a Shape, reorder sections, move or remove notes, and rename section-purpose labels.
- [x] Regenerating Shapes uses the current Writer-edited note set and occurs only on explicit request.
- [x] The Article remains unchanged through generation and Shape editing.
- [x] Tests cover premature requests, contradictions, maximum counts, note grounding, authorship boundaries, and visible Shape editing.

## Comments

### Implemented — 2026-09-12

Article Shape exploration is now an explicit, temporary request gated by one central-point note and two current supporting notes. The structure contract returns either one neutral follow-up tied to an exact unresolved area or up to three strictly shaped arrangements that reference current Session Notes by ID. Writers can select a Shape, rename and reorder its section purposes, and move or remove note references without changing the Article boundary. Contract/state coverage lives in `lib/thought-development.test.ts`, and mounted Writer-visible behavior coverage lives in `app/thought-development-dialog.test.tsx`.
