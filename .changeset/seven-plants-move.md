---
'@mastra/pg': patch
---

Fixed `@mastra/pg` crashing when an active database connection is lost between queries. Operations now fail normally instead of terminating the host process.
