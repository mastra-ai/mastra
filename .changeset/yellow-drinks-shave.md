---
'@mastra/core': patch
---

Fixed a bug where workflow-based processor execution would pass null stream parts to subsequent processors. When a processor's processOutputStream returns null (e.g., a guardrail filtering a part), the next processor in the chain would receive null as the part, causing potential errors. The null guard now matches the inline processor path behavior, skipping processors when the part is null.
