---
'@mastra/client-js': patch
---

# Add pagination support to listThreadMessages

The `listThreadMessages` client API now accepts pagination parameters to allow fetching previous chunks of conversation history.

```ts
const messages = await client.listThreadMessages('thread-123', {
  page: 1,
  perPage: 40,
});
```
