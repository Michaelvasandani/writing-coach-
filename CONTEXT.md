# Writing Coach

This context describes a writing environment that helps people strengthen their own articles while preserving authorship and voice.

## Language

**Writer**:
The person creating and revising an article with help from the coach. The writer remains the author and source of the article's ideas.
_Avoid_: User, student, content creator

**Article**:
A general-audience blog post of roughly 500–2,000 words. It may explain, reflect, or argue a point without requiring academic conventions.
_Avoid_: Academic paper, fiction, résumé, marketing copy

**Coach**:
The guidance role that identifies weaknesses, explains their effect, and helps the writer improve their own work without supplying new ideas or passages.
_Avoid_: Copilot, ghostwriter, generator

**Suggestion**:
A specific observation about the writer's draft that identifies an issue, explains why it matters, and begins with guidance rather than replacement prose.
_Avoid_: Rewrite, correction

**Passage Suggestion**:
A Suggestion whose primary evidence and improvement direction concern one anchored passage. A changed-block analysis may return at most two, and returning none is valid.
_Avoid_: Paragraph rewrite, inline correction

**Structural Suggestion**:
A Suggestion about a relationship or pattern across multiple parts of the Article. It must cite one or more ordered passage anchors even when its improvement direction concerns the Article as a whole.
_Avoid_: Unanchored general advice, separate editing mode

**Suggestion Scope**:
Whether a Suggestion addresses one passage or a structural relationship. Scope is independent of coaching category: a cross-paragraph clarity problem has structural scope and a clarity category.
_Avoid_: Suggestion category

**Passage Suggestion**:
A Suggestion about a specific passage, anchored to that passage's exact text. It may include an observation, reader impact, improvement direction, and one useful question, but it does not provide replacement prose unless the Writer explicitly requests an example.
_Avoid_: Inline correction, rewrite

**Structural Suggestion**:
A Suggestion about an Article-wide pattern or relationship between passages. It remains grounded in one or more ordered passage anchors and identifies where the Writer could act rather than offering unanchored general advice.
_Avoid_: General writing tip, article rewrite

**Correctness**:
The degree to which an Article is internally consistent, uses language without meaning-changing errors, and appropriately signals claims that may need verification. It does not imply external fact-checking unless evidence has been supplied to the Coach.
_Avoid_: Verified truth, citation audit

**Voice**:
The recognizable qualities of expression that make an article sound like its writer, including tone, phrasing, rhythm, and level of formality.
_Avoid_: Style preset

**Coaching Session**:
A cycle tied to one Article in which a Writer establishes intent, drafts or revises, receives guidance, and reviews an assessment. It may span browser visits while that Article remains active.
_Avoid_: Generation, completion

**Draft Snapshot**:
A provisional assessment of the article at its current stage, expressed as an overall coaching score, category scores, and a small set of priority improvements.
_Avoid_: Final grade, verdict

**Coach Panel**:
The editor's side panel that summarizes suggestions, displays the current draft snapshot, and helps the writer choose what to address next.
_Avoid_: AI chat, correction feed

**Thought-Development Session**:
A focused dialogue in which the Coach questions the Writer about one rough thought until its meaning, reasoning, and place in the Article are clear. Its output consists only of ideas supplied by the Writer, organized into notes or structure.
_Avoid_: Brainstorm generator, AI drafting, autocomplete

**Priority**:
One of at most three high-impact improvements selected from the current Draft Snapshot to guide the Writer's next revision.
_Avoid_: To-do list, required fix

**Writer Explanation**:
Article-scoped evidence the Writer gives in the Coach Panel about intended meaning, audience effect, a deliberate voice choice, factual context, or a broader preference. It helps the Coach reassess current and later guidance within the Coaching Session, but does not command an outcome or establish a preference across articles.
_Avoid_: Appeal, prompt correction

**Coaching Context**:
A visible, Writer-editable set of article-wide intentions and preferences that the Coach uses when interpreting the current Article. Each entry comes from a Writer Explanation and applies only within that Article; conflicting entries remain unresolved until the Writer clarifies them.
_Avoid_: Memory, profile, learned voice

**Coaching Contract**:
The version-controlled instructions, response shape, and validation rules governing one Coach behavior, such as paragraph suggestions, a Draft Snapshot, or a Thought-Development Session.
_Avoid_: Prompt, agent configuration, admin setting

**Manual Test Loop**:
A lightweight formative cycle in which Writers try the integrated prototype, report what feels wrong or unhelpful, and the builder manually chooses and makes the next iteration. It supports iteration decisions rather than proving that the Coach improves writing.
_Avoid_: Efficacy study, controlled experiment, usability certification
