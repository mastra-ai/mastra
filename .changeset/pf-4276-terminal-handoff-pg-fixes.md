---
'@mastra/pg': patch
---

Fixed the Postgres Harness terminal handoff adapter: fenced admissions are now rejected on commit, grant-scoped admit and cancel resolve the single bound admission across sessions, terminal intent lock ordering is consistent with acknowledgement and failure paths so concurrent transactions cannot deadlock, and session incarnations are minted and preserved whenever terminal handoff is enabled even without the session-record projection.
