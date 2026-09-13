# 01 — Run a safe temporary Thought-Development Session

**What to build:** Let a Writer open “Develop your ideas,” provide or edit a topic, choose a Development Focus, and begin a temporary Thought-Development Session that asks one valid neutral question at a time without changing the Article.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The setup step accepts a topic and one focus: develop thinking, find a structure, or both.
- [ ] The Session captures its starting Article boundary and keeps the visible Article read-only and unchanged.
- [ ] The application owns a prerequisite-aware development tree and sends only a ready frontier target on each turn.
- [ ] A validated turn applies readiness changes and exactly one next action atomically.
- [ ] Questions are neutral, contain no suggested answers or praise, and ask exactly one thing.
- [ ] A malformed or stale response changes no Session state and presents a recoverable error.
- [ ] A failed request retains the Writer's submitted answer, and retry with stable identity creates no duplicate message.
- [ ] Session state is excluded from the browser-local Article record.
- [ ] Automated tests drive the visible setup and first successful and failed Q&A turns.
