---
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Align stored-agent durable configuration with resumable streams: accept a boolean or `{ cleanupTimeoutMs }` and remove the checkpoint execution `maxSteps` option. Stored `durable: true` agents now hydrate as plain agents with resumable streams, not durable execution wrappers. Use an explicit code-defined `createDurableAgent({ agent })` wrapper when checkpoint persistence and recovery are required.
