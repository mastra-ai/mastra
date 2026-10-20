---
'@mastra/core': patch
---

Fixed durable and evented agents dropping earlier tool calls from the prompt on a second output processor retry. When a processor called `abort(reason, { retry: true })` more than once in a run that had already made tool calls, the next request lost the earlier tool call and its result, which broke the provider prompt cache. Durable and evented agents now keep the full history across retries, matching the standard agent loop (#27561).
