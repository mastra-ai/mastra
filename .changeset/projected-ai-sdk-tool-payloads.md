---
'@mastra/ai-sdk': patch
---

Added support for showing different tool values to users than the values used internally during execution. AI SDK streams now read Mastra display values for tool call input, streamed input deltas, tool results, tool errors, approvals, and suspensions.

```ts
const lookupCustomer = createTool({
  // Runtime still receives the full input and returns the full output.
  execute: async ({ customerId, internalPath }) => lookupCustomerRecord(customerId, internalPath),
  transform: {
    display: {
      input: ({ input }) => ({ customerId: input?.customerId }),
      output: ({ output }) => ({ displayName: output?.displayName }),
      error: () => ({ message: 'Customer lookup failed' }),
    },
  },
})
```

This lets chat UIs show safe display values while runtime code keeps the original payloads. See https://github.com/mastra-ai/mastra/issues/16054.
