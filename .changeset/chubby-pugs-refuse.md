---
'@mastra/convex': minor
---

Added native Convex vector search support for production workloads. The new `ConvexNativeVector` adapter uses
Convex schema-defined vector indexes and `ctx.vectorSearch` instead of loading vectors through `ConvexVector` and
scoring them in JavaScript.

Define a native vector table in `convex/schema.ts`:

```ts
import { defineSchema } from 'convex/server';
import { defineMastraNativeVectorTable } from '@mastra/convex/schema';

export default defineSchema({
  docs_vectors: defineMastraNativeVectorTable({
    dimensions: 1536,
  }),
});
```

Export the native vector handlers:

```ts
import {
  mastraNativeVectorAction,
  mastraNativeVectorMutation,
  mastraNativeVectorQuery,
} from '@mastra/convex/server';

export const query = mastraNativeVectorAction;
export const read = mastraNativeVectorQuery;
export const write = mastraNativeVectorMutation;
```

Then configure `ConvexNativeVector` in your Mastra app:

```ts
import { ConvexNativeVector } from '@mastra/convex';

const vectorStore = new ConvexNativeVector({
  id: 'convex-native-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  indexes: {
    docs: {
      tableName: 'docs_vectors',
      vectorIndexName: 'by_embedding',
      dimension: 1536,
    },
  },
});
```
