# Editor and AI architecture options

Researched 2026-09-12 from current official documentation and first-party references.

## Recommendation

Use a small Next.js/React app with **Tiptap 3**, a custom coaching extension backed by ProseMirror decorations, **Tiptap JSON in `localStorage`**, and one server-side Route Handler that calls the model through **Vercel AI SDK Core with a Zod schema**. Keep coaching suggestions in application/plugin state, not in the saved article.

For every paragraph and heading, use Tiptap's `UniqueID` extension. Represent an AI suggestion as:

```ts
type SuggestionAnchor = {
  blockId: string
  from: number       // offset within the block's plain text
  to: number
  quote: string      // exact analyzed text for stale-response validation
  revision: number   // client document revision used by the request
}
```

The server should return schema-validated coaching objects that reference those anchors. When a response arrives, render it only if the block still exists and `text.slice(from, to) === quote`. If the revision changed, allow an exact, unique quote rematch within the same block; otherwise discard that suggestion and queue the block for reanalysis. This hybrid anchor is simpler and safer for a delayed AI round trip than storing document-wide numeric positions alone.

## Why Tiptap is the best prototype choice

- Tiptap has an official React integration and StarterKit, which minimizes editor setup. Its React guide installs `@tiptap/react`, `@tiptap/pm`, and `@tiptap/starter-kit` and exposes the editor through React context for surrounding UI such as the Coach Panel ([Tiptap React guide](https://tiptap.dev/docs/editor/getting-started/install/react)).
- Its `UniqueID` extension assigns configurable IDs to paragraphs/headings and explicitly maintains them through split, merge, undo/redo, crop, and paste operations ([Tiptap UniqueID](https://tiptap.dev/docs/editor/extensions/functionality/uniqueid)). That provides a persistent block identity for paragraph-scoped analysis.
- Tiptap decorations are view-only: inline decorations can underline ranges without altering or serializing the article. The API supports manual refreshes and changed-range updates, and custom extensions can wrap lower-level ProseMirror plugins when necessary ([Tiptap decorations](https://tiptap.dev/docs/editor/core-concepts/decorations), [Tiptap Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension)).
- Underneath Tiptap, ProseMirror transactions include mappings that translate positions through edits, and a `DecorationSet` can be mapped forward through each transaction. This keeps already-rendered suggestion ranges attached during ordinary local edits ([ProseMirror guide: Mapping and Decorations](https://prosemirror.net/docs/guide/)).
- Tiptap recommends JSON for persistence and documents a direct `localStorage` save/restore path ([Tiptap persistence](https://tiptap.dev/docs/editor/core-concepts/persistence)). `localStorage` survives browser sessions and is broadly available ([MDN `localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)). For one 500–2,000-word article, this is adequate and materially simpler than IndexedDB.

The essential distinction is between **live local anchors** and **returned AI anchors**. A ProseMirror `DecorationSet` maps suggestions already in the editor through subsequent transactions. It cannot automatically map a range that only existed on the server during edits made while the request was in flight. Paragraph ID + local offsets + exact quote + revision closes that gap without building a full operational-transform log.

## Alternatives considered

| Option | Evidence-backed strengths | Why it is not first choice here |
| --- | --- | --- |
| Raw ProseMirror | Native decorations, plugin state, transactions, and position mapping directly satisfy the anchoring mechanics ([guide](https://prosemirror.net/docs/guide/), [reference](https://prosemirror.net/docs/ref/)). | It is deliberately a low-level toolkit. Tiptap preserves these capabilities while removing setup work, which matters more for a throwaway prototype. |
| Lexical | React plugins include `OnChangePlugin`; editor states are immutable snapshots and serializable to JSON; update listeners expose committed changes ([React plugins](https://lexical.dev/docs/react/plugins), [Editor State](https://lexical.dev/docs/concepts/editor-state)). | Lexical node keys are explicitly ephemeral, not serialized, and regenerated after deserialization ([Key Management](https://lexical.dev/docs/concepts/key-management)). Persistent paragraph identity therefore needs a custom serialized property/node state, and inline coaching marks require more custom integration than Tiptap's direct decoration API. |
| Slate | `RangeRef` objects stay synchronized as operations are applied, and Slate elements may carry custom IDs ([RangeRef](https://docs.slatejs.org/api/locations/range-ref), [Nodes](https://docs.slatejs.org/concepts/02-nodes)). | Range refs only cover the live editor process; delayed server results still require revision/quote validation. The prototype would also need to assemble more behavior and rendering conventions itself. |
| Plain `textarea`/`contenteditable` | Lowest initial dependency count. | A textarea cannot decorate arbitrary inline ranges, and raw contenteditable would require rebuilding normalized document state, selection mapping, paste handling, and undo behavior. That is false economy for Grammarly-style feedback. |

## AI integration options

### Recommended: AI SDK Core + Zod in a server Route Handler

The current AI SDK supports `generateText` with `Output.object({ schema })`; the result is typed and validated against the supplied schema, and invalid output raises `NoObjectGeneratedError` ([AI SDK structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [Output reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)). This is useful during iteration because the editor, sidebar, scoring, and thought-development modes can share explicit contracts while the underlying model remains replaceable.

A Next.js App Router Route Handler supports `POST` using the standard Request/Response APIs and is not cached by default ([Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)). It keeps the provider key and system instructions off the client. The client should send only the document intent plus the changed paragraphs for inline analysis; a separate explicit snapshot request may send the full article for scores and priorities.

### Viable simpler alternative: official OpenAI SDK directly

If the prototype is intentionally locked to OpenAI, the official API supports strict JSON Schema structured outputs and JavaScript Zod helpers ([OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)). This removes the provider abstraction. It does not remove the need for the same client anchor validation or server-side API boundary.

For this prototype, streaming structured suggestions is unnecessary. A completed, validated object after a paragraph-level pause is easier to reconcile. Thought-development conversation can use text streaming later without coupling it to inline suggestion state.

## Minimum analysis flow

1. Assign IDs to paragraphs/headings with `UniqueID`; persist editor JSON locally on update.
2. On editor updates, identify changed text blocks. After roughly 700–1,000 ms of quiet and only when the writer has moved beyond or completed the paragraph, send the newest version. Cancel or supersede older requests per block.
3. Send `{ requestId, revision, intent, tone, blocks: [{ blockId, text }] }` to a server Route Handler.
4. Validate a response shaped approximately as `{ suggestions: [{ blockId, from, to, quote, category, priority, observation, whyItMatters, question, hint }] }`. Do not include replacement prose in the default schema.
5. Reconcile against current block text. Drop stale or ambiguous anchors. Convert accepted anchors to inline decorations; store their metadata in a keyed suggestion store used by both the editor and Coach Panel.
6. Map active decorations through local transactions. A clicked sidebar item resolves its current decoration and scrolls/selects the passage.
7. Save article JSON, onboarding intent/tone, dismissed suggestion IDs, and writer explanations in browser storage. Do not persist provider responses or draft text on the server.

## Prototype boundaries and risks

- Do not build collaboration, CRDTs, cloud persistence, or a general annotation service. They do not help answer the manual-testing question.
- Do not let stale output silently underline changed text. Dropping a questionable suggestion is preferable to attaching feedback to the wrong phrase.
- Stable block IDs do not imply stable meaning after a merge or split. The quote check remains mandatory even when the ID resolves.
- `localStorage` is origin-scoped and survives sessions, so provide a visible “Clear draft” control for testers. It is sufficient here, but IndexedDB is the upgrade path if multiple documents, larger histories, or binary data enter scope.
- Keep score generation out of the paragraph debounce loop. Run the six-category score and top-three priorities only from an explicit Draft Snapshot, reducing distraction and model calls.

## Decision

Proceed with **Tiptap 3 + `UniqueID` + a custom decoration extension**, using hybrid paragraph anchors and stale-result validation; **Next.js Route Handlers + AI SDK Core/Zod** for structured coaching; and **Tiptap JSON in `localStorage`** for browser-only draft persistence. This is the smallest architecture that directly supports the intended coaching interaction without sacrificing reliable suggestion placement.
