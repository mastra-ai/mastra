---
'@mastra/pg': patch
---

Fix Postgres saveMessages to use a single batched INSERT instead of one round trip per message
