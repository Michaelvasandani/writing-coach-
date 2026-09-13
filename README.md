# Margin — local writing coach prototype

An intentionally local, manually testable browser prototype for authorship-preserving writing coaching.

## Run it

1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local` and add a Vercel AI Gateway key.
3. Run `npm install` and then `npm run dev`.
4. Open `http://localhost:3000`.

The active Article, Coaching Context, Suggestions, and Draft Snapshot stay in this browser's `localStorage`. The three Coaching Contracts live in `lib/contracts/` and can be edited independently between manual-test rounds. Model defaults are environment-controlled; the checked-in defaults use the balanced model for Snapshots and the lower-latency model for Suggestions and Thought Development.

Useful checks: `npm test`, `npm run typecheck`, and `npm run build`.
