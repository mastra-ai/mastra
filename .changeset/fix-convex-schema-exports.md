---
"@mastra/convex": minor
---

## Breaking Change

Fixed Convex schema exports to support import in `convex/schema.ts` files.

Previously, importing table definitions from `@mastra/convex/server` failed in Convex schema files because it transitively imported Node.js runtime modules (`crypto`, `fs`, `path`) that are unavailable in Convex's deploy-time sandbox.

## Changes

- Added new export path `@mastra/convex/schema` that provides table definitions without runtime dependencies
- Moved schema definitions to a separate `src/schema.ts` file
- Updated `@mastra/convex/server` to re-export schema definitions from the new location for backward compatibility

## Migration

Users should now import schema tables from `@mastra/convex/schema` instead of `@mastra/convex/server` in their `convex/schema.ts` files:

```ts
// Before
import {
  mastraThreadsTable,
  mastraMessagesTable,
} from "@mastra/convex/server";

// After
import {
  mastraThreadsTable,
  mastraMessagesTable,
} from "@mastra/convex/schema";
