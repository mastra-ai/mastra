---
'@mastra/playground-ui': minor
'mastra': patch
---

Switched Studio traces and thread views to trace queries with cursor pagination. Removed unsupported filters, Running status, and Subtraces controls; unsupported stores now surface query errors instead of falling back to legacy lists. The default window is seven days, and query-backed lists refresh every 10 seconds without new-row highlighting.
