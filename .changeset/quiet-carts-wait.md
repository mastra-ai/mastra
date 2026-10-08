---
'@mastra/core': patch
---

Fixed subagents silently returning an empty result when they call a client tool (a tool without `execute`). Subagents can't run client tools, so their run stops at that tool call. Previously the supervisor received empty text and `subAgentToolResults: []` with no indication why. Now the delegation result includes `subAgentPendingToolCalls` listing the unresolved calls, the supervisor model is told which tools were never run, and a warning is logged.

```ts
const supervisor = new Agent({
  // ...
  agents: { shopper },
  defaultOptions: {
    delegation: {
      onDelegationComplete: ({ result }) => {
        if (result.subAgentPendingToolCalls) {
          // e.g. [{ toolName: 'add-to-cart', toolCallId: '...', args: { productId: 'sku-1' } }]
        }
      },
    },
  },
});
```

Give client tools to the supervisor, or use `suspend()` in the subagent's tool when it needs input from the user.
