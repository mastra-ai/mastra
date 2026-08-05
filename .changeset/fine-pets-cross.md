---
'@mastra/core': patch
---

Fixed `filterIncompleteToolCalls: false` producing prompts that providers reject with a 400.

A tool call that suspends for approval is stored without a result. With filtering disabled that call was sent to the provider unpaired, and since every provider requires a tool call to have a matching tool result, the request failed — and kept failing on every later turn, leaving the thread unusable.

Suspended tool calls are now paired with a placeholder result instead of being sent alone, so the agent can see its pending calls and the prompt stays valid:

```typescript
const agent = new Agent({
  name: 'approvals',
  model: 'openai/gpt-5-mini',
  memory,
});

// Before: this turn failed with 'No tool output found for function call ...'
// After: the agent answers and can see the pending approval
await agent.stream('Do I have anything waiting on my approval?', {
  memory: {
    thread: 'thread-1',
    resource: 'user-1',
    options: { filterIncompleteToolCalls: false },
  },
});
```

The default (`true`) is unchanged — suspended calls are still dropped from the prompt.
