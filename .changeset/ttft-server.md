---
'@mastra/server': minor
---

Trace, thread, span and aggregate queries now accept `timeToFirstTokenMs` predicates, and trace and span queries can sort by it. The new `traceQueryTimeToFirstToken` and `traceQueryTimeToFirstTokenSort` capabilities tell you whether the configured observability store supports them. When it doesn't, the request returns `501` with a clear message before the store runs.
