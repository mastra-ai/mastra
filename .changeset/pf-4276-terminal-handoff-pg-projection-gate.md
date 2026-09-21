---
'@mastra/pg': patch
---

Fixed Harness terminal handoff storage on Postgres.

- Session-record projection outbox writes now require the projection feature itself, so terminal-only stores no longer emit undrained fence, intent, and capacity rows.
- Terminal admission lookups by run and pending probes are scoped by session incarnation, matching the in-memory adapter.
