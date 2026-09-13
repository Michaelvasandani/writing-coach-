# Integrate the manually testable prototype

Type: task
Status: resolved
Assignee: Codex
Blocked by: 07, 13, 15

## Question

Build the smallest integrated local prototype that implements the resolved interaction, architecture, Coaching Contracts, and selected model defaults, then make it available for free exploration and manual iteration with Writers.

## Comments

### Integrated implementation checkpoint — 2026-09-12

Built the local Next.js/Tiptap prototype in the repository root. It includes the persistent quiet split workspace, browser-local Article and Coaching Session record, stable block IDs and synchronized ProseMirror decorations, passage and structural Suggestions, Writer Explanations and visible article-scoped Coaching Context, explicit Draft Snapshot refresh with up to three Priorities, and an explicit Thought-Development overlay that leaves the Article unchanged.

The three server Route Handlers use independently editable, versioned Coaching Contracts under `lib/contracts/`, AI SDK structured output, current Vercel AI Gateway model IDs, and deterministic checks for response identity, stale anchors, category completeness, evidence sufficiency, per-mode limits, and one-question cadence. Model defaults remain overrideable per contract through local environment variables.

Verified:

- `npm test`: 8 tests pass.
- `npm run typecheck`: passes.
- `npm run build`: passes and exposes all three contract routes.
- Browser: page renders without console errors; Article editing persists across reload; responsive Coach Panel and Thought Development overlay render; UI actions reach the expected API routes.
- Missing-credential behavior: routes return a clean `422` with `AI_GATEWAY_API_KEY is not configured`; the UI surfaces the error without crashing.

The previously blocking [Provision the local AI credential and smoke-test live coaching](15-provision-ai-credential-and-smoke-test.md) is now resolved: all three real-model paths pass through the browser. This integration ticket is unblocked and ready for final resolution in the next Wayfinder session.

## Answer

### Resolution — 2026-09-12

The integrated local prototype is ready for free exploration and manual iteration with Writers at `http://localhost:3000`.

It implements the resolved quiet split workspace with a dominant Tiptap Article and persistent, tabbed Coach Panel; Writer-set purpose and audience; browser-local Article and Coaching Session persistence; stable paragraph and heading IDs; synchronized inline passage and structural Suggestion decorations; Writer Explanations and visible article-scoped Coaching Context; explicitly refreshed Draft Snapshots with six calibrated categories and up to three Priorities; and an explicit Thought-Development overlay that asks one neutral question at a time while leaving the Article unchanged.

Three narrow Next.js Route Handlers run independently editable, versioned Coaching Contracts through Vercel AI Gateway. Suggestions and Thought Development default to `openai/gpt-5.6-luna`; Draft Snapshots default to `openai/gpt-5.6-terra`; every default remains locally overrideable. Deterministic application checks enforce request identity, Article revision, evidence anchors, category completeness, evidence-sufficiency invariants, per-mode limits, duplicate suppression, feedback caps, and one-question cadence. Exact-quote offsets are normalized only when the quote occurs once in the stated block; invented or ambiguous evidence remains rejected.

Verification covered the complete live flow. Passage analysis returned a schema-valid anchored Suggestion and rendered synchronized feedback. Draft Snapshot returned all six categories, two Priorities, and a derived overall score. Thought Development returned and rendered one neutral frontier question. Article content persisted across reload, browser diagnostics were clean, all ten tests passed, TypeScript passed, and the production build exposed all three contract routes.

The prototype deliberately remains local and single-Article: no accounts, collaboration, remote document storage, hosted deployment, or production infrastructure were added.
