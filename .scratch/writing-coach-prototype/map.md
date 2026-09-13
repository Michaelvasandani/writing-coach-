# AI Writing Coach Prototype

Type: wayfinder:map

## Destination

A working, manually testable browser prototype of an AI writing coach for 500–2,000-word general-audience blog posts. It must help people strengthen their own writing through intent-setting, inline feedback, thought-development grilling, structural coaching, and draft snapshots while preserving the writer's ideas and voice.

## Notes

- This effort carries prototype execution and manual iteration inside the map; reaching the destination means producing and testing the prototype, not only specifying it.
- Consult the grilling, domain-modeling, prototype, and research skills as their ticket types require.
- The core promise is: the writer finishes a stronger draft, understands up to three meaningful priority improvements, and still recognizes every sentence as their own.
- Support blank articles and pasted drafts, real AI feedback, browser-local drafts, paragraph-level analysis after a pause, and a persistent Coach Panel.
- The Coach may identify, explain, question, organize writer-provided material, and show an example only when asked. It must not invent the writer's arguments, experiences, evidence, conclusions, or prose.
- Optimize for fast learning from 5–8 manual testers rather than production completeness.

## Decisions so far

- [Writer explanations that teach the coach](issues/01-writer-explanations.md) — Treat explanations as article-bound, Writer-controlled evidence that triggers transparent, scoped reassessment without automatic exemptions or cross-article learning.

- [Draft snapshot calibration](issues/03-draft-snapshot-calibration.md) — Score observed reader impact on a shared five-point scale while expressing evidence sufficiency and uncertainty separately.

- [Editor and AI architecture options](issues/05-editor-architecture-options.md) — Use Tiptap 3 decorations with hybrid block anchors, schema-validated server-side AI responses, and browser-local Tiptap JSON.

- [Reusing the grilling method](issues/04-grilling-runtime-reuse.md) — Embed its design-tree/frontier method as explicit app state; do not make the MVP depend on a developer-machine skill installation.

- [Minimum prototype architecture](issues/06-prototype-architecture.md) — Use one local Next.js/Tiptap app with browser-local session state, three narrow coaching routes, and independently editable Coaching Contracts.

- [Core coaching loop interaction](issues/02-core-coaching-loop.md) — Keep the editable Article dominant beside a persistent, tabbed Coach Panel, with quiet synchronized marks and explicitly entered Thought Development.

- [Writer Explanation AI contract and evaluation cases](issues/09-writer-explanation-ai-contract.md) — Use a versioned, schema-validated selective-reassessment contract with explicit per-Suggestion outcomes, Writer escalation for ambiguity, and deterministic live-anchor validation.

- [Draft Snapshot AI contract and calibration cases](issues/08-draft-snapshot-ai-contract.md) — Use a versioned six-category contract with evidence-anchored judgments, explicit insufficiency and confidence, deterministic validation and overall scoring, and intent-aware calibration.

- [Thought-Development Session AI contract](issues/11-thought-development-ai-contract.md) — Use a client-owned prerequisite tree with one neutral frontier question, source-linked Writer notes, deterministic completion, disclosed gaps, and unchanged-Article return.

- [Paragraph and structural Suggestion AI contract](issues/10-suggestion-ai-contract.md) — Use one two-mode, evidence-anchored contract with explicit lifecycle dispositions, deterministic atomic validation and deduplication, bounded feedback, and separate Priority authority.

- [Manual test loop](issues/07-manual-test-loop.md) — Let Writers explore freely and report problems in person; keep iteration under builder judgment without formal scripts, metrics, instrumentation, or thresholds.

- [Current model options for the Coaching Contracts](issues/12-current-model-options.md) — Evaluate balanced, low-cost, cross-provider, latency-specialist, and one diagnostic ceiling candidate with explicit reasoning settings and contract-level semantic, latency, authorship, and cost measures.

- [Cross-contract model evaluation and selection](issues/13-cross-contract-model-evaluation.md) — Use a staged 8-pack/16-invocation harness with deterministic and authorship hard gates, repeated route-specific finalists, and one diagnostic ceiling run for shared failures.

- [Provision the local AI credential and smoke-test live coaching](issues/15-provision-ai-credential-and-smoke-test.md) — A private Gateway credential and paid capacity now support schema-valid live Suggestions, Snapshots, and Thought Development in the browser.

- [Integrate the manually testable prototype](issues/14-integrate-manually-testable-prototype.md) — The local Tiptap workspace now runs all approved coaching interactions and contracts through live, validated model routes and is ready for informal Writer exploration.

## Not yet specified

- The problems found in the first informal Writer round will determine which prototype behaviors, if any, need another iteration; those decisions cannot be ticketed until the observations exist.

## Out of scope

- Academic writing and citation checking, fiction, poetry, résumés, and marketing copy.
- AI-generated positions, evidence, personal experiences, conclusions, paragraphs, or complete articles.
- Accounts, collaboration, cloud document history, Google Docs import/export, payments, and production-grade mobile support.
- Permanent server-side storage of tester drafts.
- Hosted deployment and remote tester access; the first prototype and its testing run locally.
