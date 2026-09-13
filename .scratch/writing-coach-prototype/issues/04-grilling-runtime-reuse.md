# Reusing the grilling method

Type: research
Status: resolved

## Question

Can the deployed browser prototype invoke the existing local grilling skill directly, and if not, what parts of its design-tree and frontier method can be faithfully embedded in the product's Thought-Development Session?

## Comments

### Resolution

Do not couple the prototype to the installed local `grilling` skill. Embed its design-tree, prerequisite-aware frontier, post-answer recomputation, and explicit-completion method as an app-owned Thought-Development contract with structured state. Preserve the product's one-question-at-a-time cadence and omit recommended answers so the coach draws out rather than supplies the writer's thinking. An uploaded or inline API skill is technically possible later, but it would be a separate packaged artifact rather than direct use of the local installation.

Findings: [Reusing the grilling method in the browser prototype](../research/04-grilling-runtime-reuse.md)
