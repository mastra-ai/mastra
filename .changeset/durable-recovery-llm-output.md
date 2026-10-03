---
'@mastra/core': patch
---

Fix durable agent recovery crashing with `Cannot read properties of undefined (reading 'messages')` when a process is killed while a tool call is running. The durable iteration workflow now declares `durable-llm-mapping` as a reader of `durable-llm-execution`, so the snapshot pruner keeps `llm-execution`'s output while mapping is the restart target.
