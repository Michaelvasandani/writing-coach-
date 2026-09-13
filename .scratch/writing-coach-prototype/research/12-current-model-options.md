# Current model options for the Coaching Contracts

Researched 2026-09-12 from the four approved local Coaching Contracts and current first-party model/API documentation. Prices are public list prices in USD per one million tokens on that date; they can change and should be captured again when the evaluation runs.

## What the contracts require

The four contracts create two distinct workloads rather than one generic “writing” task:

1. **Bounded document judgment:** Draft Snapshot, Suggestion analysis, and Writer reassessment consume a 500–2,000-word Article plus stable block IDs, intent/audience, Coaching Context, and active-feedback state. They must return a relatively complex discriminated object with complete enumerations, exact-quote anchors, conservative uncertainty, and no invented prose. The application then performs semantic and stale-anchor validation atomically ([Draft Snapshot contract](../issues/08-draft-snapshot-ai-contract.md), [Writer Explanation contract](../issues/09-writer-explanation-ai-contract.md), [Suggestion contract](../issues/10-suggestion-ai-contract.md)).
2. **Interactive constrained coaching:** Thought Development is a multi-turn exchange whose response is exactly one question, state patch, or completion request. It must follow a client-owned prerequisite frontier, derive every substantive note from a cited Writer turn, and never edit the Article ([Thought-Development contract](../issues/11-thought-development-ai-contract.md)).

Consequently, the useful model-selection criteria are:

- semantic adherence beyond syntactically valid JSON: complete dispositions, correct discriminated variants, exact evidence, and silence when feedback is weak;
- instruction discipline around authorship, uncertainty, scope, and one-question cadence;
- stable structured outputs for nested objects, arrays, enums, nullable fields, and unions;
- low enough latency for paragraph-pause analysis and live Thought Development, with somewhat more tolerance for explicit whole-Article Snapshot requests;
- controllable reasoning so the evaluator can find the lowest-cost/lowest-latency setting that preserves quality;
- ordinary text context capacity. Even the smallest credible candidate below has far more than this prototype needs, so context-window size should not decide the winner.

Tool calling is supported by all shortlisted model families, but the approved contracts do not need a model to invoke external tools. It is therefore a compatibility check, not a quality advantage for this prototype.

## Credible current candidates

| Model | Official positioning and relative latency | Standard text price (input / output) | Structured output and controls | Why it belongs in the evaluation |
| --- | --- | ---: | --- | --- |
| **OpenAI GPT-5.6 Terra** (`gpt-5.6-terra`) | OpenAI's balance of intelligence and cost | **$2 / $12** | Structured Outputs and function calling; 1.05M context; reasoning effort `none`, `low`, `medium`, `high`, `xhigh`, or `max`; the GPT-5 family also exposes output verbosity | Strong general baseline for all four contracts, especially evidence interpretation and selective reassessment ([OpenAI models](https://developers.openai.com/api/docs/models), [model comparison](https://developers.openai.com/api/docs/models/compare), [model guidance](https://developers.openai.com/api/docs/guides/latest-model)). |
| **OpenAI GPT-5.6 Luna** (`gpt-5.6-luna`) | Cost-sensitive, high-volume tier | **$0.20 / $1.20** | Structured Outputs, function calling, streaming, 1.05M context, and the same six reasoning-effort levels | Necessary low-cost/fast challenger for changed-block Suggestions and Thought-Development turns; its “nano” positioning makes nuanced authorship and evidence judgments an empirical risk rather than an assumption ([GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)). |
| **Anthropic Claude Sonnet 5** (`claude-sonnet-5`) | Anthropic calls it the best combination of speed and intelligence and labels comparative latency “fast” | **$2 / $10** | Constrained-decoding JSON output, strict tool inputs, streaming, 1M context, adaptive thinking, and `low` through `max` effort | Close price peer to Terra and a credible all-contract candidate, particularly for conversational coaching and nuanced reader-impact explanations ([Claude model overview](https://platform.claude.com/docs/en/models/overview), [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)). |
| **Anthropic Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | Anthropic's “fastest” current model | **$1 / $5** | Structured outputs and tool use; streaming; 200K context; extended thinking, but no `effort` parameter | Useful latency-oriented challenger, especially for paragraph pauses and one-question turns. Its lack of an effort knob and older capability tier make it less flexible than Luna in a settings sweep ([Claude model overview](https://platform.claude.com/docs/en/models/overview), [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Claude latency guidance](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency)). |
| **Google Gemini 3.8 Flash** (`gemini-3.8-flash`) | Google's current stable Flash model, positioned for Flash speed/cost efficiency plus complex workflows | **$0.75 / $3.75 through 2026-12-31; $1.50 / $7.50 afterward** | Structured outputs, function calling, streaming consumption, 1,048,576-token input, 65,536-token output, and thinking levels `low`, `medium`, and `high` | Strong cross-provider price/performance candidate for all four contracts. Promotional pricing must be reported separately from the durable 2027 rate ([Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini latest-model guide](https://ai.google.dev/gemini-api/docs/latest-model)). |

Two high-capability models are useful only as **diagnostic ceilings**, not as default candidates: **GPT-6 Astra** costs $10/$50 and does not support `none` reasoning; **Claude Opus 5** costs $5/$25 and is labeled moderate latency. Run one of them on failed or ambiguous cases to learn whether a miss is a model-capability ceiling or a contract/prompt defect, but testing both across the full matrix would add expense without much information ([OpenAI model comparison](https://developers.openai.com/api/docs/models/compare), [GPT-6 Astra guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra), [Claude model overview](https://platform.claude.com/docs/en/models/overview)).

Older OpenAI GPT-4/o-series models and older Gemini Flash generations should not enter the first comparison: both providers' current catalogs designate newer successors, while the goal is to choose a current prototype default rather than preserve a legacy integration ([OpenAI all models](https://developers.openai.com/api/docs/models/all), [Gemini models](https://ai.google.dev/gemini-api/docs/models)).

## Structured-output implications

All five candidates can emit schema-constrained JSON, but syntax guarantees do **not** validate the Coaching Contract's meaning. A schema can guarantee that an anchor has `{blockId, from, to, quote}` fields; it cannot guarantee that the quote exists at those offsets, that every affected Suggestion is present exactly once, that a note is entailed by the cited Writer turn, or that coaching avoids replacement prose. The deterministic validators specified in the four contracts remain mandatory.

- **OpenAI:** `json_schema` Structured Outputs are preferred over older JSON mode and make the response match the supplied schema. The API separately represents refusal/incomplete outcomes, so the harness must score those rather than treating every HTTP success as a contract result ([OpenAI Responses reference](https://developers.openai.com/api/reference/resources/responses), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
- **Anthropic:** `output_config.format` guarantees valid JSON matching a supported JSON Schema subset; `strict: true` separately validates tool names and inputs. Schema changes inject format guidance and invalidate that conversation's prompt cache. Citations cannot be combined with strict JSON output, although these contracts carry their own ordinary evidence fields rather than provider citation blocks ([Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
- **Gemini:** `response_format` supports a subset of JSON Schema and SDK helpers for Pydantic and Zod. Gemini explicitly distinguishes final structured output from function calling, which is the correct fit here because the model need not execute an intermediate tool ([Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini tools overview](https://ai.google.dev/gemini-api/docs/tools)).

Before the cross-provider run, compile the actual four schemas against each provider once. Provider schema subsets differ; if the native discriminated union does not compile unchanged, record the smallest provider adapter and keep the semantic contract identical. Do not silently simplify a contract for one model.

## Settings worth controlling

Use explicit settings rather than provider defaults, and hold everything except the tested dimension constant.

| Provider | Settings to sweep | Important caveat |
| --- | --- | --- |
| OpenAI GPT-5.6 | `reasoning.effort`: begin with `none` and `low`, add `medium` only where evals improve; `text.verbosity: low`; a contract-specific output-token cap; strict JSON Schema | OpenAI describes effort as a speed/cost versus depth tradeoff and advises increasing it only when evals show a gain. Output verbosity changes answer length separately from reasoning depth ([OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)). |
| Claude Sonnet 5 | `output_config.effort`: compare `low` and `medium`; prompt an explicit length bound; set `max_tokens`; JSON schema format | Claude defaults supported models to `high`; lower effort can reduce latency and tokens, but effort is behavioral rather than a hard budget. Changing top-level effort can invalidate prompt caching ([Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)). |
| Claude Haiku 4.5 | Prompt length bound, `max_tokens`, schema format; test extended thinking only if baseline cases fail | Haiku has no `effort` control, so it is a model-tier comparison more than an effort sweep ([Claude model overview](https://platform.claude.com/docs/en/models/overview)). |
| Gemini 3.8 Flash | `thinking_level`: compare `low` and `medium`; `max_output_tokens`; JSON response schema | `minimal` is unsupported, and current migration guidance says to remove `temperature`, `top_p`, `top_k`, and `candidate_count`. Thinking tokens count toward both output pricing and the output-token limit ([Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Gemini latest-model guide](https://ai.google.dev/gemini-api/docs/latest-model), [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)). |

Sampling controls should not be the center of the evaluation. The hard product failures here concern contract adherence, evidence, restraint, and latency; reasoning depth and output bounds are both more direct and more portable across providers.

## Cost and latency interpretation

For scale only, a request billed for **4,000 input tokens and 800 total output/reasoning tokens** would cost approximately:

| Model | Illustrative request cost |
| --- | ---: |
| GPT-5.6 Luna | **$0.00176** |
| Gemini 3.8 Flash, 2026 promotional rate | **$0.0060** |
| Claude Haiku 4.5 | **$0.0080** |
| Gemini 3.8 Flash, 2027 standard rate | **$0.0120** |
| Claude Sonnet 5 | **$0.0160** |
| GPT-5.6 Terra | **$0.0176** |
| Claude Opus 5 ceiling | **$0.0400** |
| GPT-6 Astra ceiling | **$0.0800** |

These are arithmetic illustrations from the cited list prices, not predicted production bills. Actual requests will vary by contract, retries, cached tokens, and hidden reasoning-token use. Gemini explicitly includes thinking tokens in output billing; OpenAI and Anthropic likewise use reasoning/effort to trade more generated work for cost and latency ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model), [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)).

No provider publishes a latency guarantee that maps cleanly to these contract payloads and settings. Anthropic's “fast/fastest” labels are comparative, and Google/OpenAI describe optimization tiers rather than a stable end-to-end number. Measure at least p50 and p95 wall-clock latency per contract/setting, plus time to first token only for Thought Development if the UI streams. Structured one-shot contracts should also record time to a complete validated object; fast first text is irrelevant if the UI cannot safely apply a partial object. Anthropic's own latency guidance distinguishes time to first token from full generation time and recommends model choice, shorter inputs/outputs, and streaming as the principal levers ([Claude latency guidance](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency), [Claude streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)).

## Contract-specific fit hypotheses to test

These are hypotheses for the downstream evaluation, not selection conclusions.

- **Draft Snapshot:** start with Terra-low, Sonnet-medium, and Gemini-low/medium. This is the most holistic judgment contract; add one ceiling-model pass on cases involving unconventional intent, insufficiency, or divergent category scores.
- **Writer reassessment:** use the same three general candidates. Score completeness of per-Suggestion dispositions and conservative escalation especially heavily; a cheap model that omits one affected item is not usable even when its prose reads well.
- **Suggestion analysis:** include Luna-low/none and Haiku alongside Terra-low and Gemini-low. This route is latency- and volume-sensitive and permits silence, making it the strongest opportunity for a smaller model. Test `changed_block` separately from `whole_article`; they need not share a model default even though they share a contract.
- **Thought Development:** compare Luna-low, Terra-low, Sonnet-low/medium, and Gemini-low. Measure one-question compliance, leading language, source-entailment of notes, and responsiveness across a multi-turn trajectory rather than isolated turns.

Because the local architecture already chose Vercel AI SDK Core with a Zod boundary, provider variation is feasible, but provider-native request fields and schema subsets still require thin adapters ([Editor and AI architecture options](../issues/05-editor-architecture-options.md)).

## Shortlist for the cross-contract evaluation

Use the following compact matrix:

1. **GPT-5.6 Terra** at `low` effort as the balanced OpenAI baseline; add `medium` only for contracts/cases where it produces a measured gain.
2. **GPT-5.6 Luna** at `none` and `low` for the low-cost, latency-sensitive challenge, prioritizing Suggestion and Thought-Development cases.
3. **Claude Sonnet 5** at `low` and `medium` as the principal cross-provider quality candidate.
4. **Gemini 3.8 Flash** at `low` and `medium` as the principal cross-provider price/performance candidate.
5. **Claude Haiku 4.5** only on the latency-sensitive Suggestion and Thought-Development subset.
6. **One ceiling model, not two**—GPT-6 Astra-low or Claude Opus 5-medium—only on shared failures and the hardest calibration cases.

The downstream ticket should select defaults from observed contract-level quality, semantic-validity rate, authorship violations, p50/p95 latency, and actual token cost. It should remain open to different defaults by route or mode; there is no technical requirement that all four Coaching Contracts use the same model.

## Uncertainties to preserve

- Public price and model catalogs are time-sensitive; re-check them immediately before running or interpreting the evaluation.
- Provider claims such as “fast,” “balanced,” or “near-frontier” are not comparable measurements across vendors.
- Structured-output guarantees cover syntax/schema, not the contract's semantic invariants or evidence truth.
- Reasoning and thinking controls are not numerically equivalent across providers; compare outcomes and measured resource use, not setting names.
- Promotional Gemini pricing ends on 2026-12-31, so a choice justified only by the temporary rate is fragile.
- None of the official sources establishes which model best preserves Writer ownership in these exact interactions. That is the central local evaluation question.
