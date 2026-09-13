# Cross-contract model evaluation and selection

Type: prototype
Status: resolved
Assignee: Codex
Blocked by: 12

## Question

What smallest repeatable evaluation harness and representative cross-contract case set will compare the researched model candidates, expose authorship or contract failures, and select effective model and setting defaults for the manually tested prototype?

## Comments

### Prototype ready for Writer review — 2026-09-12

Drive the fast-challenger, authorship-veto, hidden-instability, shared-failure, and split-default walkthroughs in [Cross-contract model evaluation](../prototypes/13-cross-contract-model-evaluation.html).

The proposal uses eight shared case packs producing sixteen scored invocations, a one-pass screen across applicable candidates, and three repeated runs only for two finalists per route. Deterministic contract validity and Writer-authorship preservation are hard selection gates; eligible models are then compared on blinded coaching quality, measured p50/p95 time to a complete validated object, Thought-Development time to first token, and actual token cost. Defaults may differ by contract and by Suggestion mode.

This remains a human-in-the-loop decision. Before resolving it, confirm or revise four choices: whether the staged funnel is small enough, whether any authorship or repeated deterministic failure should veto a candidate, whether the eight packs cover the important failure surface, and whether route-specific defaults are acceptable.

### Resolution — 2026-09-12

Use a staged, source-controlled evaluation harness built around eight shared article/event packs and sixteen scored invocations across the five selectable routes: Draft Snapshot, Writer reassessment, changed-block Suggestions, whole-Article Suggestions, and Thought Development. The packs cover an early sketch, a mature draft with uneven quality, intentional fragments before and after intent is known, an explained tradeoff, conflicting Coaching Context, stale Article state, a multi-turn rough thought, and an explicit authorship/ownership trap. Reuse the same material across contracts where possible so model differences are not hidden by unrelated prose.

Before model comparison, compile each real Coaching Contract schema against every provider and record the smallest required provider adapter without weakening the semantic contract. Freeze the request fixtures, expected deterministic outcomes, human-review notes, contract and prompt versions, case revision, and current provider pricing in source control.

Run the candidate funnel in three stages:

1. Run each shortlisted model and explicit reasoning setting once on every applicable invocation. Record refusals, incomplete responses, provider errors, schema validity, all contract-specific deterministic checks, complete-object latency, token usage, and actual cost. Record time to first token only for streamed Thought-Development turns.
2. Blind the model identity for human review of coaching quality and Writer ownership. Keep the cheapest or fastest passing challenger and the strongest passing candidate for each route.
3. Run those two finalists three fresh times on every applicable invocation. This repeated finalist stage detects instability without paying for a full repeated factorial comparison.

A configuration is eligible for a route only when every repeated finalist run has zero deterministic contract failures and zero authorship violations. Replacement prose, invented arguments, evidence, examples, experiences, or conclusions are authorship violations even when the output otherwise reads well. Among eligible configurations, prefer the lowest measured p95 complete-object latency for interactive routes and the lowest actual cost when latency is acceptable; use blinded coaching quality as the tie-breaker. Select defaults independently by route and allow changed-block and whole-Article Suggestion modes to use different defaults.

When all finalists fail the same hard case, run one ceiling model once. If the ceiling model also fails, inspect and repair the fixture, prompt, schema, adapter, or validator before resuming comparison. A ceiling-model success is diagnostic evidence of a capability gap, not an automatic default selection.

The Writer approved the evaluation size, hard-gate rules, shared case set, and route-specific selection approach without requested changes.

Prototype: [Cross-contract model evaluation](../prototypes/13-cross-contract-model-evaluation.html)
Captured on branch: `prototype/cross-contract-model-evaluation` at `e29c0b1`
