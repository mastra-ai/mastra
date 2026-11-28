---
'@mastra/core': patch
---

Added agent-wide `defaultDisposition` and `modelOverrides` to `backgroundTasks`, so tools opted in through `tools: 'all'` (or a named entry) can share one policy instead of repeating it per tool.

```ts
new Agent({
  // ...
  backgroundTasks: {
    tools: 'all',
    defaultDisposition: 'foreground',
    modelOverrides: false,
  },
});
```

Both act as defaults: a per-tool entry wins over the agent-wide value, and a tool's own `background` config fills anything left unset. `enabled` is never inherited, so agent-wide fields can't opt a tool in on their own.

A `_background` value the model sends to a tool whose resolved policy disallows overrides is now dropped before schema validation and approval checks, so strict tool schemas no longer reject the call.

Fixes #31614.
Fixes #31612.
