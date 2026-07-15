---
'@mastra/convex': minor
---

Added Observational Memory support to the Convex storage adapter. Agents using `ConvexStore` can now enable `observationalMemory` in `@mastra/memory`, including async observation buffering and reflections.

To enable it, add the new `mastraObservationalMemoryTable` to your Convex schema and redeploy:

```ts title="convex/schema.ts"
import { defineSchema } from 'convex/server';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraObservationalMemoryTable,
  // ...other Mastra tables
} from '@mastra/convex/schema';

export default defineSchema({
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_observational_memory: mastraObservationalMemoryTable,
  // ...other Mastra tables
});
```

Then run `npx convex deploy` (or `npx convex dev`) so the new table and storage operations are live. All observational memory writes run inside the deployed Convex storage mutation, so buffered-observation swaps and reflection generations are atomic.
