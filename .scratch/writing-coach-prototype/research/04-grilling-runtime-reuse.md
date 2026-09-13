# Reusing the grilling method in the browser prototype

## Decision

Do **not** make the MVP depend on invoking the installed local `grilling` skill at runtime. Instead, copy its small, durable interaction protocol into an app-owned Thought-Development contract and keep the session state explicit in the application.

This preserves the method while avoiding a coupling between a deployed product and one developer machine. A packaged API skill remains a later implementation option, not an MVP requirement.

## Why the installed skill is not directly reusable

The installed skill is a Markdown instruction file for an agent. Its actual method is expressed entirely as prose: maintain a design tree, compute the unblocked frontier, ask questions in rounds, recompute after answers, and stop when the frontier is empty. It exposes no browser-callable function, API endpoint, or executable runtime of its own.[^local-skill]

OpenAI's current beta Responses schema distinguishes two different mechanisms:

- A **local skill** is referenced by a filesystem `path` inside a `local` computer environment.[^local-environment]
- An **inline skill** is a base64-encoded ZIP attached to a request.[^inline-skill]

Therefore, the existing path `/Users/michaelvasandani/.agents/skills/grilling/` is usable only by a runtime operating on that local computer. A deployed prototype cannot reach that installation merely because the developer has it installed. This is an inference from the local-environment/path contract, not an explicit statement in the documentation.

The platform also exposes a Skills API that accepts uploaded skill files or a ZIP and returns a project-scoped skill resource.[^skills-api] So the method could later be packaged and versioned for API use. That would be a separate deployment artifact, not a direct invocation of the existing local installation, and it adds lifecycle complexity that is unnecessary for this prototype.

## What to embed faithfully

Use these concepts from the local skill:

1. **Design tree:** Represent the writer's emerging thought as decisions/claims with prerequisites. For this product, the core branches are: the point, why the writer believes it, supporting example or evidence, why it matters to the intended reader, and where it belongs in the article.
2. **Frontier:** A question is eligible only when all information it depends on has been settled by the writer. Never ask a downstream question by guessing its prerequisite.
3. **Recomputation:** After every writer answer, summarize only what the writer supplied, update settled/open nodes, and recompute the eligible questions.
4. **Shared understanding:** Let the writer correct the summary or use the sidebar's “Explain yourself” action. Treat that correction as authoritative session context.
5. **Explicit completion:** Finish when the five core branches are adequately settled or the writer ends early. Return organized notes and a suggested article location, never generated article prose.

## Intentional product adaptations

The in-app experience should **not** reproduce every presentational rule in the local skill:

- Ask **one focused question at a time**, as already chosen for the prototype, instead of displaying the entire frontier in one round.
- Do not number questions or attach a recommended answer by default; recommendations can lead the writer and undermine authorship.
- Keep the design tree and frontier hidden unless exposing them proves useful in testing.
- Prefer questions grounded in the writer's current passage and stated audience over general brainstorming prompts.

These adaptations retain the dependency discipline of the method while fitting a writing flow where conversational depth and writer ownership matter more than breadth-first decision coverage.

## Minimal runtime contract

Have the server send the Thought-Development instructions on every model turn and require a structured result such as:

```json
{
  "writer_summary": "Only ideas explicitly supplied by the writer",
  "settled": ["point"],
  "open": ["reason", "support", "reader_relevance", "article_location"],
  "next_question": "One question whose prerequisites are settled",
  "done": false,
  "organized_notes": null,
  "suggested_location": null
}
```

The Responses API supports multi-turn continuation through `previous_response_id` and JSON Schema Structured Outputs.[^responses] Its documentation also says instructions from a prior response are not carried forward when using `previous_response_id`, so the server must resend the coaching/authorship instructions on each turn.[^responses]

Keep the canonical state in browser-local draft/session data rather than trusting an opaque model conversation as the only record. Validate each response before updating the UI. The app, not the model, should enforce that only one question is shown, that completion fields appear only when `done` is true, and that generated prose is rejected from the notes payload.

## Prototype implication

The build can start without a general skill loader. Implement Thought Development as:

- one fixed developer instruction derived from the method above;
- one small explicit state object stored with the local draft;
- one structured model response per writer turn;
- deterministic UI safeguards for one-question cadence and no-prose output.

If manual testing shows the same protocol must be shared across several products or maintained independently of the app, revisit uploading it as a versioned API skill.

## Sources

[^local-skill]: Local primary source: [`grilling/SKILL.md`](/Users/michaelvasandani/.agents/skills/grilling/SKILL.md), inspected 2026-09-12.
[^local-environment]: OpenAI API Reference, [beta local environment and local skill schema](https://developers.openai.com/api/reference/cli/__sdk_schema?declaration=%28resource%29+beta.responses+%3E+%28model%29+beta_local_environment+%3E+%28schema%29&selected=%28resource%29+beta.responses), inspected 2026-09-12.
[^inline-skill]: OpenAI API Reference, [beta inline skill schema](https://developers.openai.com/api/reference/cli/__sdk_schema?declaration=%28resource%29+beta.responses+%3E+%28model%29+beta_inline_skill+%3E+%28schema%29&selected=%28resource%29+beta.responses), inspected 2026-09-12.
[^skills-api]: OpenAI API Reference, [Create Skill](https://developers.openai.com/api/reference/python/resources/skills/methods/create), inspected 2026-09-12.
[^responses]: OpenAI API Reference, [Create a model response](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), inspected 2026-09-12.
