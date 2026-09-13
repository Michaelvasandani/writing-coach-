# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append under a `## Comments` heading

## Publishing and fetching

When a skill says to publish to the issue tracker, create the appropriate file under `.scratch/<feature-slug>/`, creating the feature directory when needed. When a skill says to fetch a ticket, read the referenced local file in full.

## Blocking edges

Each implementation ticket records its blockers by ticket number and title. A ticket is ready to start when every listed blocker is complete.

## Wayfinding operations

- A Wayfinder map lives at `.scratch/<effort>/map.md`.
- Its child tickets live at `.scratch/<effort>/issues/NN-<slug>.md`.
- A child ticket records its type, status, and any blocking ticket numbers near the top.
- The frontier is the first open, unblocked, and unclaimed ticket by number.
- Claim a ticket before working and resolve it by recording the answer and adding a context pointer to the map.
