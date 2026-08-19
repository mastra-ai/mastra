---
'@mastra/core': patch
---

Fixed a reply coming back duplicated after an interrupted turn. When an error-retry processor or the durable loop moved the response message id without sealing the stored response, the streamed message split where the stored one did not, so the second half reappeared under its own id on reload. Rotating a response message id now seals the response it leaves behind, so the two can no longer drift apart.

Durable runs now honour the same error-retry hooks as regular runs: `processAPIError` receives `messageId` and a working `rotateResponseMessageId`, so a processor can close the failed response and answer the retry in a message of its own instead of appending to it.

```ts
const agent = new Agent({
  name: 'support',
  model: 'openai/gpt-5-nano',
  maxProcessorRetries: 1,
  errorProcessors: [
    {
      id: 'retry-in-a-new-message',
      processAPIError: async ({ rotateResponseMessageId }) => {
        rotateResponseMessageId?.();
        return { retry: true };
      },
    },
  ],
});
```

Message ids minted during a durable run also honour a custom `generateId` configured on `Mastra`, which some paths silently ignored.
