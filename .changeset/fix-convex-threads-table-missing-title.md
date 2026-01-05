---
'@mastra/convex': patch
'@mastra/core': patch
---

Fix missing `title` field in Convex threads table schema

The Convex schema was hardcoded and out of sync with the core `TABLE_SCHEMAS`, causing errors when creating threads:

```
Error: Failed to insert or update a document in table "mastra_threads" 
because it does not match the schema: Object contains extra field `title` 
that is not in the validator.
```

Now the Convex schema dynamically builds from `TABLE_SCHEMAS` via a new `@mastra/core/storage/constants` export path that doesn't pull in Node.js dependencies (safe for Convex's sandboxed schema evaluation).

```typescript
// Users can now import schema tables without Node.js dependency issues
import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema';

export default defineSchema({
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
});
```

Fixes #11319
