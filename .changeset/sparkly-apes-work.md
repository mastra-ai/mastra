---
'@mastra/langfuse': patch
---

Map the root span's metadata and span type to `langfuse.trace.metadata.*` so keys like `runId` and `threadId` are filterable trace metadata again, matching the legacy exporter. fixes #23187
