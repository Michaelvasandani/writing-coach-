# Domain Docs

This is a single-context repository. Engineering skills should read the domain documentation before exploring or changing the codebase.

## Before exploring, read these

- Read `CONTEXT.md` at the repository root.
- Read relevant decisions under `docs/adr/` when that directory exists.
- If a referenced document does not exist, proceed without treating its absence as an error.

## Use the glossary's vocabulary

Use the canonical terms defined in `CONTEXT.md` in specifications, tickets, tests, and code-facing proposals. Avoid synonyms that the glossary explicitly rejects. If a necessary domain concept is missing, reconsider the terminology or use the domain-modeling workflow to resolve the gap.

## Flag decision conflicts

Surface any conflict with an existing ADR explicitly instead of silently overriding it.
