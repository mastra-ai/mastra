---
'@mastra/core': minor
---

RAG ingestion runs now appear in observability traces, next to your agents, workflows, and scorers.

You can now filter traces by `traceId` when listing them.

Added lightweight span and trace schemas (`LightSpanRecord`, `GetTraceLightResponse`) that exclude heavy fields like `input`, `output`, `attributes`, and `metadata` — reducing per-span payload by ~97% for timeline rendering.
