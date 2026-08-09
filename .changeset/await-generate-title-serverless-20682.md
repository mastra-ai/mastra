---
'@mastra/core': patch
---

Fixed thread title generation being dropped on serverless runtimes by accepting an optional `serverless.waitUntil` on `generate()`/`stream()` so title persistence stays alive after the response without blocking the run. (#20682)

```ts
import { waitUntil } from '@vercel/functions';

await agent.generate('Name this conversation', {
  serverless: { waitUntil },
  memory: {
    thread: 'thread-1',
    resource: 'user-1',
    options: { generateTitle: true },
  },
});
```
