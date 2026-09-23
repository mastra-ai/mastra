---
'@mastra/pg': patch
---

Fixed the Postgres Harness terminal handoff adapter.

- Fenced admissions are now rejected on commit.
- Cancelling an already-fenced admission reports `fenced` instead of claiming a `cancelled` transition storage never made.
- A late commit on a fenced admission with a cancellation tombstone now surfaces the fence instead of a stale `cancelled` receipt.
- Grant-scoped admit and cancel resolve the single bound admission across sessions.
- Terminal intent lock ordering is consistent across acknowledgement and failure paths, so concurrent transactions cannot deadlock.
- Session incarnations are minted and preserved whenever terminal handoff is enabled, even without the session-record projection.
