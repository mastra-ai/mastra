---
'@mastra/memory': patch
---

Fixed a "Converting circular structure to JSON" crash when Observational Memory was used with an input or output processor composed as a workflow (the "run guardrails in parallel" pattern).

The circular data reached the processor workflow's snapshot and broke storage: PostgreSQL threw, and LibSQL saved a corrupted snapshot. Observational Memory now keeps its runtime data in a serializable form, so workflow-composed processors work with it and snapshots persist correctly.
