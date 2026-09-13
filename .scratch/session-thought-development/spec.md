# Session-only Thought Development

Status: resolved

## Problem Statement

Writers often know the general subject of an Article but have not yet worked out their central point, supporting reasoning, examples, reader relevance, or organizing structure. The current prototype offers a minimal Thought-Development dialog, but it follows a fixed sequence, does not expose the notes it extracts, cannot help the Writer compare structures, and loses answers without clearly explaining that the Session is temporary. Writers need a focused Q&A experience that helps them discover and organize their own thinking without allowing the Coach to become the author.

## Solution

Expand the existing Thought-Development Session into a temporary, client-owned workspace. A Writer starts with a topic or visible Article context, selects whether they want to develop their thinking, find a structure, or do both, and answers one neutral Coach question at a time. The Session maintains a prerequisite-aware development tree, source-linked and Writer-editable Session Notes, visible Development Readiness, and—when explicitly requested and sufficiently grounded—up to three temporary Article Shapes.

The Coach uses only substance the Writer supplied. It may question, classify, summarize, and arrange that substance, but it may not invent arguments, examples, evidence, experiences, conclusions, headings, or Article prose. The Article stays visible but read-only and unchanged throughout the Session.

This first version is intentionally ephemeral. Its transcript, Session Notes, readiness, and Article Shapes remain available only while the dialog is open. The Writer may copy clean Markdown or the transcript before closing. Closing or reloading discards the Session, and no Session material is supplied to Suggestions or Draft Snapshots.

## User Stories

1. As a Writer with a vague topic, I want to start a Thought-Development Session, so that I can clarify what I want to say.
2. As a Writer with an existing draft, I want to start from a selected passage, so that the Coach can focus on the thought I am developing.
3. As a Writer reviewing feedback, I want to start from a Suggestion, so that I can work through the reasoning needed to address it.
4. As a Writer reviewing a Draft Snapshot, I want to start from a Priority, so that I can develop the underlying idea before revising.
5. As a Writer, I want contextual source material to be visibly prefilled, so that I know what the Session will discuss.
6. As a Writer, I want to edit the prefilled topic, so that the Session follows my intended focus rather than the Coach's inference.
7. As a Writer, I want to choose whether to develop my thinking, find a structure, or do both, so that the questioning matches my immediate need.
8. As a Writer, I want the Coach to ask one question at a time, so that I can concentrate on one decision without being overwhelmed.
9. As a Writer, I want each question to depend on what I have already settled, so that the conversation progresses coherently.
10. As a Writer, I want questions to be neutral and free of suggested answers, so that the resulting ideas remain mine.
11. As a Writer, I want the Coach to avoid praise and leading premises, so that the conversation focuses on meaning rather than approval.
12. As a Writer, I want to answer in rough language, so that I do not have to draft polished prose during idea development.
13. As a Writer, I want to skip a question, so that uncertainty in one area does not trap the Session.
14. As a Writer, I want to revise an earlier answer, so that the Session reflects changes in my thinking.
15. As a Writer, I want downstream questions and proposed notes to be reconsidered after an answer changes, so that stale assumptions do not survive.
16. As a Writer, I want to redirect the Session's focus, so that an emerging but relevant concern can become the active subject.
17. As a Writer, I want to finish for now, so that I can leave with partial thinking rather than being forced to complete every area.
18. As a Writer, I want visible Development Readiness, so that I understand which parts of the thought are developed, unresolved, or skipped.
19. As a Writer, I want periodic opportunities to continue, review notes, or finish, so that an open-ended conversation does not feel endless.
20. As a Writer, I want my answers retained when an AI request fails, so that retrying never makes me reconstruct my thinking.
21. As a Writer, I want a failed turn to leave existing Session state unchanged, so that partial model output cannot corrupt the conversation.
22. As a Writer, I want the Coach to extract small Session Notes from my answers, so that I can see the useful substance emerging from the Q&A.
23. As a Writer, I want every Session Note linked to the answers that support it, so that I can verify that the Coach preserved my meaning.
24. As a Writer, I want an answer to produce no note when it adds no substantive information, so that the notes remain useful rather than exhaustive.
25. As a Writer, I want to edit or delete Session Notes, so that the working record expresses what I actually mean.
26. As a Writer, I want notes collected quietly in a drawer, so that they remain available without interrupting every answer.
27. As a Writer, I want to open the notes drawer during the Session, so that I can inspect and correct the working record at any time.
28. As a Writer, I want the Coach to withhold a structure when my notes are insufficient or contradictory, so that it does not invent connective logic.
29. As a Writer, I want the Coach to identify the exact unresolved area and ask one follow-up question, so that I know how to make structural exploration useful.
30. As a Writer, I want to request structures explicitly, so that an early organization does not prematurely frame my thinking.
31. As a Writer, I want to compare up to three Article Shapes, so that I can choose an organizing logic that fits my ideas.
32. As a Writer, I want each Article Shape to explain its organizing logic and tradeoff, so that I can make an informed structural choice.
33. As a Writer, I want Article Shapes to arrange only my Session Notes, so that the Coach does not introduce new substance.
34. As a Writer, I want Shapes expressed as section purposes rather than polished headings, so that I retain responsibility for the Article's language.
35. As a Writer, I want to reorder sections and move or remove notes, so that I can adapt a Shape to my intended progression.
36. As a Writer, I want to rename section-purpose labels, so that the structure uses language that makes sense to me.
37. As a Writer, I want to copy Session Notes and a selected Article Shape as clean Markdown, so that I can preserve useful work manually.
38. As a Writer, I want unresolved questions included in copied notes, so that I remember what still needs thought.
39. As a Writer, I want to copy the transcript separately, so that chronology does not clutter the concise notes by default.
40. As a Writer, I want a warning before closing a non-empty Session, so that I do not accidentally lose my work.
41. As a Writer, I want to copy and close in one action, so that preserving temporary work is convenient.
42. As a Writer, I want the Article visible but read-only during the Session, so that I retain context without creating revision ambiguity.
43. As a Writer, I want confirmation that Thought Development never edits the Article, so that I remain in control of every sentence.
44. As a Writer, I want a request for invented arguments or examples redirected into a question about my own knowledge, so that the Coach preserves authorship even when I ask for generation.
45. As a Writer, I want closing or reloading to discard the Session, so that the first version behaves according to its stated temporary scope.
46. As a Writer, I want Session material excluded from Suggestions and Draft Snapshots, so that exploratory thinking cannot silently affect later critique.

## Implementation Decisions

- Expand the existing Thought-Development Session rather than introduce a separate Brainstorm feature or domain object. The primary visible action is “Develop your ideas.”
- Add a setup step that collects a Writer-editable topic and one Development Focus: develop thinking, find a structure, or both.
- Support entry from the persistent Coach Panel action and contextual entry from a selected passage, Suggestion, or Priority. Contextual sources prefill but never lock the topic.
- Keep the Session in temporary client-owned state outside the browser-local Article and Coaching Session record. Closing the dialog, clearing the page state, or reloading destroys it.
- Capture an immutable starting Article boundary and source context. Keep the Article visible but read-only while the dialog is active and never emit Article edits.
- Represent thought development as a prerequisite-aware tree covering the central point, reasoning, support or example, intended reader relevance, and structural placement. The application owns the tree, recomputes its frontier, and determines readiness.
- Ask exactly one neutral question targeting a ready frontier item. Questions must not contain suggested answers, bundled questions, leading premises, praise, or replacement prose.
- Provide Skip, Revise answer, Change focus, and Finish for now controls. Revising an answer invalidates dependent proposed material and recomputes the frontier; malformed or failed turns change no accepted state.
- Do not impose a hard question limit. After five questions and every three questions thereafter, offer continue, review partial notes, or finish for now.
- Allow each Writer answer to produce zero or more atomic proposed Session Notes. Every note cites its supporting Writer turn or turns and contains only entailed substance.
- Show Session Notes in a quiet in-session drawer. The Writer may inspect, edit, or delete them at any time; the Writer-edited version is authoritative for the remainder of the Session.
- Replace the existing per-turn response with an atomic envelope containing proposed note changes, a Development Readiness patch, and exactly one next action: ask a question, offer structural exploration, or complete. Article Shapes appear only in explicitly requested structural responses.
- Validate echoed Session and turn identity, source-turn references, frontier targeting, one-question cadence, readiness transitions, authorship constraints, response completeness, and Shape limits before applying the response.
- Retain the Writer's submitted answer while a request is pending or failed. Retries use stable turn identity and must not duplicate messages or notes.
- Enable Explore structures only when a central-point note and at least two supporting notes are available. A premature or contradictory request returns the unresolved area and one neutral question instead of a fabricated structure.
- Return no more than three Article Shapes. Each Shape is an ordered set of section purposes with referenced Session Notes and a concise organizing-logic tradeoff. It contains no generated heading or Article prose.
- Allow the Writer to select a Shape, reorder its sections, move or remove notes, and rename section-purpose labels. These edits remain temporary Session state.
- Copy concise Markdown containing the topic, Session Notes grouped by role, the selected Shape when present, and unresolved questions. Copying the transcript is a separate action.
- Warn before discarding a Session that contains a Writer answer or Session Note. Offer Copy and close, Close without copying, and Keep working.
- Do not send the Thought-Development Transcript, Session Notes, readiness, or Article Shapes to Suggestion or Draft Snapshot analysis in this version.
- Preserve the current local single-Article architecture and the existing Thought Development Route Handler. No persistence or general memory subsystem is introduced.

## Testing Decisions

- Tests should assert Writer-visible behavior and contract outcomes rather than component state, hook calls, prompt text, or internal implementation structure.
- The primary seam is the mounted Thought-Development dialog in a browser-like Vitest environment with deterministic API responses. Tests drive setup, Writer answers, visible notes, readiness, Shapes, retries, copying, and closing through accessible controls.
- A small supporting contract seam covers invariants that the dialog cannot reliably prove alone: valid frontier targets, source entailment references, stable turn identity, atomic rejection, readiness transitions, and maximum Shape counts.
- Existing coaching-helper tests provide prior art for deterministic frontier and validation cases. Existing browser smoke checks provide prior art for verifying that the Article remains unchanged and API failures surface without crashing.
- Cover launches from a vague topic, selected passage, Suggestion, and Priority.
- Verify one neutral question per turn and rejection of bundled, leading, or malformed questions.
- Verify that notes are source-linked, editable, deletable, and restricted to Writer-supplied substance.
- Verify that skip and revised-answer flows recompute readiness and invalidate dependent proposed material.
- Verify that insufficient or contradictory material cannot produce an Article Shape.
- Verify that valid structure exploration produces at most three Shapes grounded exclusively in current Session Notes.
- Verify that Shape editing changes copied output without changing Article content.
- Verify that a failed request retains the Writer answer and that retry does not duplicate messages or notes.
- Verify Markdown note/Shape copying, separate transcript copying, and all three loss-confirmation choices.
- Verify that closing and reloading remove all Session material and that the browser-local Article record never contains it.
- Verify that Suggestion and Draft Snapshot request payloads remain free of Thought-Development Transcript, Session Notes, readiness, and Article Shapes.
- Retain live-model smoke coverage for one full Session after deterministic tests pass, checking authorship restraint and schema-valid output without making nondeterministic model prose part of automated assertions.

## Out of Scope

- Persisting or resuming a Thought-Development Session after its dialog closes or the page reloads.
- A permanent Notes or Development tab in the Coach Panel.
- Article-scoped Development Notes, session history, cloud synchronization, accounts, server storage, or cross-device access.
- Supplying exploratory material to Suggestions, Draft Snapshots, Writer reassessment, or later Coaching Sessions.
- Hidden model memory or provider conversation state as a source of truth.
- Automatically inserting headings, outlines, placeholders, sentences, passages, arguments, evidence, examples, experiences, or conclusions into the Article.
- Automatically converting a Session Note or Article Shape into Article content.
- Evaluating whether an Article has incorporated a Session Note.
- Supporting writing domains outside the prototype's existing general-audience Article scope.

## Further Notes

- “Brainstorm” may be used in approachable explanatory copy, but it is not a separate feature or canonical domain term because the Coach does not generate ideas.
- The future persistent version will require a separately designed Article-scoped development record, lifecycle rules, conflict handling, visible provenance, and explicit critique-context behavior. This specification must not pre-empt those decisions.
- The session-only boundary is deliberately reversible and does not warrant an ADR. The domain language for Thought-Development Session, Development Focus, Thought-Development Transcript, Session Note, Article Shape, and Development Readiness is maintained in the project glossary.
