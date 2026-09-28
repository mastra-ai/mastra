---
'@mastra/inngest': patch
'@mastra/core': patch
---

Data chunks emitted by output processors via `writer.custom()` are now persisted to thread history on the durable engine, matching the regular agent loop (#19375). Transient chunks remain stream-only.
