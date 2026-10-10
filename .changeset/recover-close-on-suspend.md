---
'@mastra/core': patch
---

Added `closeOnSuspend` to `DurableAgent.recover()`, matching `stream()` and `resume()`. When a recovered run suspends (for example, waiting on tool approval), the returned `fullStream` now ends, so callers can hand off to `resume()` instead of hanging.

```ts
const recovered = await agent.recover(runId, { closeOnSuspend: true });
for await (const chunk of recovered.fullStream) {
  // ends after `tool-call-approval`
}
```
