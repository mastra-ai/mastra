---
'@mastra/clickhouse': patch
---

Trace aggregates now read each trace's root span once from the requested time window, instead of re-reading every stored root row of the matching traces. This lowers `aggregateTraces()` latency, bytes read, and memory, most on large projects.
