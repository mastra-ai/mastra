---
'@mastra/mysql': patch
---

Fixed missing UNIQUE and PRIMARY KEY constraints on mastra_workflow_snapshot and mastra_ai_spans tables. Without these keys, ON DUPLICATE KEY UPDATE never fired, causing a new row per workflow step instead of updating in place.
