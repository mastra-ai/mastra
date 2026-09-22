---
'@mastra/client-js': minor
---

Added delta polling inputs and response types for queryTraces(), including the cursor returned with numbered pages.

```ts
// Start with a numbered page.
const page = await client.queryTraces({ timeRange, pagination: { page: 0, perPage: 100 } });
// Continue with delta polling.
const delta = await client.queryTraces({ timeRange, mode: 'delta', after: page.deltaCursor });
```
