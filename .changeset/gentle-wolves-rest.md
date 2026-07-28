---
'@mastra/pg': patch
---

Fixed Postgres startup failures when multiple API and worker processes initialize the same schema simultaneously.
