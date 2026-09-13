# Minimum prototype architecture

Type: grilling
Status: resolved
Assignee: Codex
Blocked by: 04, 05

## Question

Given the research findings, which minimum architecture should the prototype adopt so the core coaching behavior can be changed quickly during manual testing without overbuilding infrastructure?

## Comments

### Resolution — 2026-09-12

Build the prototype as one local Next.js application with a Tiptap editor, a persistent Coach Panel, and one versioned browser-local record containing the active Article and Coaching Session. Use stable paragraph and heading IDs plus ProseMirror decorations for inline feedback, and keep suggestions outside the saved Article content.

Expose three narrow server Route Handlers—paragraph suggestions, Draft Snapshot, and Thought Development—because these behaviors have different inputs, response shapes, timing, and failure modes. Back them with one shared AI SDK Core model client, common authorship safeguards, and Zod validation. Give each behavior its own source-controlled Coaching Contract containing its instructions, structured response schema, and validation policy, so it can change independently between manual-test rounds without an admin interface.

Run both browser and server locally for the first prototype. Configure the provider key and selected model through local environment variables. Preserve ordinary client/server boundaries so hosting later does not require redesign, but do not build deployment configuration, accounts, a database, remote draft storage, provider switching, or an administrative configuration UI in this effort.

This is the minimum architecture boundary:

- one local Next.js/React application;
- Tiptap JSON persisted in `localStorage` for one active Article and Coaching Session;
- a custom Tiptap/ProseMirror coaching extension using hybrid block anchors;
- three behavior-specific Route Handlers;
- one shared model client and authorship policy;
- three independently editable Coaching Contracts; and
- no production infrastructure.
