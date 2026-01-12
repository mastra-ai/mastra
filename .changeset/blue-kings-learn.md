---
'@mastra/mongodb': patch
---

Fix MongoDB scores storage sort logic to use numeric sort values (-1) instead of string values ('desc') for consistency with other MongoDB domains (agents, memory, observability, workflows).
