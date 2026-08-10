---
'@mastra/pg': patch
---

Improved chat response time with PostgresStore. Message history now reads a page of messages and its total count in one query instead of two. When semantic recall is on, the recall read also starts at the same time as the page read. Each agent turn therefore makes fewer database round-trips, which is most noticeable on remote Postgres.
