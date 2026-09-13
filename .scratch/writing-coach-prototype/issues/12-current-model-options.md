# Current model options for the Coaching Contracts

Type: research
Status: resolved

## Question

Which currently available models, structured-output capabilities, latency and cost characteristics, and controllable settings are credible candidates for the four approved Coaching Contracts in the local prototype?

## Comments

## Answer

### Resolution — 2026-09-12

Carry six comparisons into [Cross-contract model evaluation and selection](13-cross-contract-model-evaluation.md): GPT-5.6 Terra at low effort as the balanced baseline; GPT-5.6 Luna at none and low effort as the low-cost, latency-sensitive challenger; Claude Sonnet 5 at low and medium effort as the principal cross-provider quality candidate; Gemini 3.8 Flash at low and medium thinking as the principal cross-provider price/performance candidate; Claude Haiku 4.5 only for the latency-sensitive Suggestion and Thought-Development subset; and one ceiling model only on shared failures or the hardest calibration cases.

All shortlisted families support schema-constrained structured output, but provider schemas must be compiled up front and their semantic results must still pass the Coaching Contracts' deterministic checks for completeness, evidence anchors, source entailment, stale revisions, and authorship boundaries. Tool calling is not a differentiator because none of the four approved contracts needs the model to invoke an external tool.

The evaluation should measure contract-level semantic-validity rate, authorship violations, p50/p95 time to a complete validated object, Thought-Development time to first token where streaming is used, and actual token cost. It should test changed-block Suggestions separately from whole-Article analysis and remain open to different defaults by contract or mode. Public catalogs, prices, and promotional rates must be refreshed when the evaluation runs.

Full primary-source comparison: [Current model options for the Coaching Contracts](../research/12-current-model-options.md).
