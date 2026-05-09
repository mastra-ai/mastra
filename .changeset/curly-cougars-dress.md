---
'@mastra/core': minor
---

Added target-aware tool payload transforms for display streams and transcript messages. Tool authors can transform tool input, output, errors, approval payloads, and suspension payloads without changing raw runtime behavior or toModelOutput. See https://github.com/mastra-ai/mastra/issues/16054.

Use `transform` on tools, agents, Mastra, or individual generation calls to configure these payload transforms. Runtime callers using the previous `toolPayloadProjection` shape continue to be normalized for compatibility.

```ts
const lookupCustomer = createTool({
  execute: async ({ customerId, internalPath }) => lookupCustomerRecord(customerId, internalPath),
  transform: {
    display: {
      input: ({ input }) => ({ customerId: input?.customerId }),
      output: ({ output }) => ({ displayName: output?.displayName }),
    },
    transcript: {
      input: ({ input }) => ({ customerId: input?.customerId }),
      output: ({ output }) => ({ displayName: output?.displayName }),
    },
  },
})
```
