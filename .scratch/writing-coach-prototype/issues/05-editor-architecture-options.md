# Editor and AI architecture options

Type: research
Status: resolved

## Question

Which current, primary-source-supported web editor and AI integration options best support range-anchored suggestions, paragraph-level debounced analysis, structured coaching responses, local draft persistence, and a fast single-user prototype?

## Comments

### Resolution — 2026-09-12

Use Tiptap 3 with paragraph/heading `UniqueID`s and a custom ProseMirror-decoration extension. Anchor AI feedback by block ID + block-local offsets + exact quote + document revision, validate it against the current block when the delayed response returns, and discard/reanalyze ambiguous stale results. Use a Next.js server Route Handler with AI SDK Core and Zod-validated structured output, while persisting Tiptap JSON locally in the browser. This keeps the prototype fast to change while directly supporting reliable inline underlines, a synchronized Coach Panel, debounced paragraph analysis, and explicit Draft Snapshots.

Detailed primary-source findings: [Editor and AI architecture options](../research/05-editor-architecture-options.md)
