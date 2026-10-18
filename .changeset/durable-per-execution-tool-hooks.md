---
'@mastra/core': patch
---

Fixed durable and evented agents ignoring per-execution tool hooks. `hooks.beforeToolCall` and `hooks.afterToolCall` passed to `agent.stream()` / `agent.generate()` (or set in `defaultOptions.hooks`) now run and override agent-level hooks on every engine, matching the regular agent loop.

```ts
await agent.stream('Look up the order', {
  hooks: {
    beforeToolCall: () => ({ proceed: false, output: { status: 'mocked' } }),
  },
});
```
