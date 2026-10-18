---
'@mastra/core': patch
---

Fixed tool hooks passed to `agent.stream()` and `agent.generate()` being ignored in durable and evented agents. Per-call `beforeToolCall` and `afterToolCall` hooks now take priority over agent-level hooks. Hooks in `defaultOptions.hooks` also run in these engines.

```ts
await agent.stream('Look up the order', {
  hooks: {
    beforeToolCall: () => ({ proceed: false, output: { status: 'mocked' } }),
  },
});
```
