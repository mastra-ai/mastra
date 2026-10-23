---
'@mastra/core': patch
---

Fixed tool hooks passed to `agent.stream()` and `agent.generate()` being ignored in durable and evented agents. Per-call `beforeToolCall` and `afterToolCall` hooks now take priority over agent-level hooks. Hooks in `defaultOptions.hooks` also run in these engines.

Per-call hooks are functions and only live in the process that received the call. If a run resumes in a different process, only constructor hooks and `defaultOptions.hooks` run, so put hooks you always need there.

```ts
await agent.stream('Look up the order', {
  hooks: {
    beforeToolCall: () => ({ proceed: false, output: { status: 'mocked' } }),
  },
});
```
