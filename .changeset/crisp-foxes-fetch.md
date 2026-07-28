---
'@mastra/core': patch
---

Added a `requireDelivery` option to agent-controller session signals. When set, `session.sendSignal` waits for the agent to accept the wake signal and rejects if delivery fails, instead of resolving optimistically. This lets callers that need guaranteed delivery (like the Factory rule dispatcher) detect and retry failed kickoffs.

```ts
const result = session.sendSignal(
  { id, type: 'user', tagName: 'user', contents: message },
  { requestContext, requireDelivery: true },
);
// Resolves only once the agent has accepted the signal (`action` is
// 'wake' or 'deliver'); rejects if the wake never reaches an agent.
const { action, runId } = await result.accepted;
```
