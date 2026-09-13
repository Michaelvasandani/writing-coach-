# Provision the local AI credential and smoke-test live coaching

Type: task
Status: resolved
Assignee: Codex

## Question

Configure a local Vercel AI Gateway credential without committing it, then verify that one paused-passage Suggestion, one requested Draft Snapshot, and one Thought-Development turn each return a schema-valid live-model response that the browser renders.

## Comments

### Writer checklist

1. Copy `.env.example` to `.env.local`.
2. Put a valid Vercel AI Gateway key in `AI_GATEWAY_API_KEY` inside `.env.local`; do not paste the key into this issue or commit it.
3. Restart `npm run dev` so Next.js loads the credential.
4. Invoke Wayfinder with this ticket so Codex can run and record the three live smoke tests.

## Answer

### Resolution — 2026-09-12

The Writer configured a private `AI_GATEWAY_API_KEY` in the gitignored `.env.local` and added paid Gateway capacity. Live verification then exercised every contract boundary against the running browser prototype:

- Passage Suggestions returned `suggestion-analysis.v1` with echoed Article identity, a bounded candidate set, and accepted exact evidence anchors. A model occasionally returned correct unique quotes with incorrect offsets; the application now normalizes those offsets only when the exact quote occurs once in the stated block, while continuing to reject invented or ambiguous evidence.
- Draft Snapshot returned `draft-snapshot.v1` with all six categories, two meaningful Priorities, and an application-derived overall score. Its evidence uses the same unique-quote normalization and rejection boundary.
- Thought Development returned `thought-development.v1` with echoed session, turn, and frontier-node identity plus exactly one neutral question.
- Browser verification showed two synchronized inline Suggestions, two rendered Priorities, and the live Thought-Development question. Browser diagnostics contained no warnings or errors.

Final checks: 10 tests pass, TypeScript passes, the production build succeeds with all three dynamic contract routes, and no temporary debug instrumentation remains.
