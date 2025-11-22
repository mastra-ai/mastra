# @mastra/convex

Convex adapters for Mastra:

- `ConvexStore` implements the Mastra storage contract (threads, messages, workflows, scores, resources).
- `ConvexVector` stores embeddings inside Convex and performs cosine similarity search.
- `@mastra/convex/server` exposes the required Convex table definition and internal mutation so you can keep data inside your Convex deployment.

## Quick start

1. **Install**

```bash
pnpm add @mastra/convex
```

2. **Wire up Convex server**

In `convex/schema.ts`:

```ts
import { defineSchema } from 'convex/schema';
import { mastraDocumentsTable } from '@mastra/convex/server';

export default defineSchema({
  mastra_documents: mastraDocumentsTable,
});
```

In `convex/mastra/storage.ts` (or any file you prefer):

```ts
import { mastraStorage } from '@mastra/convex/server';

export const handle = mastraStorage;
```

3. **Use in Mastra**

```ts
import { ConvexStore } from '@mastra/convex';

const storage = new ConvexStore({
  id: 'convex',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
  storageFunction: 'mastra/storage:handle', // default, override if you renamed the file
});
```

For vectors:

```ts
import { ConvexVector } from '@mastra/convex';

const vector = new ConvexVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});
```

> **Note**  
> The default implementation stores records inside a generic Convex table and performs cosine search in-process. It is meant as a starting point and can be replaced with custom Convex modules if you need dense indexes or hybrid search.

## Status

Experimental – expect breaking changes while the adapter matures.
