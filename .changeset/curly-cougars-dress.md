---
'@mastra/core': minor
---

Added target-aware tool payload projection for display streams and transcript messages. Tool authors can project tool input, output, errors, approval payloads, and suspension payloads without changing raw runtime behavior or toModelOutput. See https://github.com/mastra-ai/mastra/issues/16054.

```ts
const lookupCustomer = createTool({
  execute: async ({ customerId, internalPath }) => lookupCustomerRecord(customerId, internalPath),
  payloadProjection: {
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
