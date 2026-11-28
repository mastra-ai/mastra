---
'@mastra/core': minor
---

Durable agent `generate()` calls now match regular `generate()` calls on the provider, and stay readable after they return.

**Provider method**: `durableAgent.generate()` now uses the provider's non-streaming generation call, like a regular agent's `generate()`. `stream()` still streams. A recovered run keeps the method it started with.

**Reconnect by run ID**: A `generate()` run now stays replayable for `cleanupTimeoutMs` (30 seconds by default) after it ends, like a `stream()` run. Before, it was cleared as soon as `generate()` returned. Any process that shares the replay cache and PubSub transport can rebuild the full result, including usage, steps, and structured output:

```ts
const result = await durableAgent.generate('Summarize the report');

// In another process, within the cleanup window
const { output } = await durableAgent.observe(result.runId);
const replayed = await output.getFullOutput();
```
