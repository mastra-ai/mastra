---
'@mastra/core': minor
---

Added an opt-in `advisor` option to `Agent`, so a running agent can consult a stronger model mid-run without moving its whole run onto that model.

```typescript
const agent = new Agent({
  id: 'research-agent',
  model: 'openrouter/small-model',
  tools: { search, fetchPage },
  advisor: {
    model: 'openrouter/strong-model',
    maxUses: 3,
  },
})
```

When `advisor` is set, the agent is given an `ask_advisor` tool. Calling it runs one short, tool-less model call on the advisor model, with the executor's transcript (including the tool calls and results of the current run) and its instructions, and returns the reply as the tool result. The executor keeps going in the same run on its own model, and the advisor's usage is reported as its own run rather than being counted into the executor's.

`maxUses` (default `3`) caps consults per run; once it is reached the tool returns an error-shaped result instead of failing the run. A user-declared `ask_advisor` tool takes precedence over the framework-provided one.
