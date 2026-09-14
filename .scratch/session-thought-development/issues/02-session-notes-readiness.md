# 02 — Collect Session Notes and show Development Readiness

**What to build:** Turn the Writer's answers into a transparent, editable set of temporary Session Notes while showing which prerequisite areas are answered, skipped, or still unresolved.

**Blocked by:** 01 — Run a safe temporary Thought-Development Session.

**Status:** resolved

- [x] Each answer may yield zero or more atomic proposed Session Notes linked to supporting Writer turns.
- [x] Notes unsupported by the cited Writer answers cause the entire turn response to be rejected.
- [x] A quiet drawer shows collected notes without interrupting the Q&A and can be opened at any time.
- [x] The Writer can edit or delete any Session Note, and later Session behavior uses the edited set.
- [x] Development Readiness visibly covers central point, reasoning, support, reader relevance, and structural placement.
- [x] Skip advances dependency traversal while leaving the gap visible.
- [x] Revising an answer invalidates dependent proposed material and recomputes the ready frontier without silently changing Writer-edited notes.
- [x] Change focus and Finish for now preserve the current partial notes while the dialog remains open.
- [x] After five questions and every three thereafter, the Writer can continue, review partial notes, or finish.
- [x] Tests cover note-free answers, source linkage, note editing and deletion, skip, answer revision, and readiness recomputation.

## Comments

Implemented in `lib/thought-development.ts` and `app/thought-development-dialog.tsx`, with contract/state coverage in `lib/thought-development.test.ts` and mounted Writer-visible behavior coverage in `app/thought-development-dialog.test.tsx`.
