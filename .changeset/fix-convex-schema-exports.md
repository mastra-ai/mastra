#!/bin/bash
# Create a changeset for the convex schema exports fix
# Using the changeset CLI to ensure proper formatting

# Create the changeset interactively is not possible in script mode
# So we'll create the file directly following the repository's format

CHANGESET_FILE=".changeset/fix-convex-schema-exports.md"

cat > "$CHANGESET_FILE" << 'EOF'
---
"@mastra/convex": minor
---

**Breaking Change**: Fixed Convex schema exports to support import in `convex/schema.ts` files

Previously, importing table definitions from `@mastra/convex/server` failed in Convex schema files because it transitively imported Node.js runtime modules (crypto, fs, path) that are unavailable in Convex's deploy-time sandbox.

**Changes:**
- Added new export path `@mastra/convex/schema` that provides table definitions without runtime dependencies
- Moved schema definitions to separate `src/schema.ts` file
- Updated `@mastra/convex/server` to re-export schema definitions from the new location for backward compatibility

**Migration:**
Users should now import schema tables from `@mastra/convex/schema` instead of `@mastra/convex/server` in their `convex/schema.ts` files:

```typescript
// Before
import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/server'

// After
import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema'
```

Fixes #11240
EOF

echo "✓ Changeset created at $CHANGESET_FILE"
echo ""
echo "Contents:"
cat "$CHANGESET_FILE"