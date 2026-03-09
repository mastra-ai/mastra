---
'@mastra/pg': patch
---

Fixed slow semantic recall in the Postgres storage adapter for large threads. Recall now completes in under 500ms even for threads with 7,000+ messages, down from ~30 seconds. (Fixes #11702)
