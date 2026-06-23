---
'@mastra/observability': patch
---

Fixed auto-extracted metrics (duration, token usage, cost) being silently dropped when spans are filtered via `excludeSpanTypes` or `spanFilter`. Previously, excluding a span type to reduce per-span costs in platforms like Langfuse also suppressed its aggregate metrics. Metrics are now emitted independently of span export filtering.
