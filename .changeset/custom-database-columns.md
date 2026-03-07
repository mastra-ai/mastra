---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Add support for custom user-defined columns in Mastra database tables. Developers can now enrich the default storage schema with their own fields without spinning up a separate database or writing a custom storage adapter. This makes Mastra's Memory layer more flexible for real-world multi-tenant and domain-specific use cases.

## What's new:

- `schemaExtensions` configuration option for storage adapters (PostgreSQL, LibSQL) to declare custom columns
- `customColumns` property on threads carrying user-defined column values
- Filtering support in `listThreads()` to query by custom column values
- Automatic schema creation and migration handling for custom columns

## Example usage:

**Before:** Custom data forced into metadata (unindexed, harder to query)
```typescript
const memory = new Memory({ storage });
const thread = await memory.createThread({
  resourceId: 'user-123',
  metadata: { organizationId: 'org-456' }, // Not indexed
});
```

**After:** Custom columns as first-class fields (indexed, queryable)
```typescript
const memory = new Memory({
  storage: new PostgresStore({
    schemaExtensions: {
      'mastra_threads': {
        organizationId: { type: 'text', nullable: false },
        tenantId: { type: 'text', nullable: true },
      },
    },
  }),
});

const thread = await memory.createThread({
  resourceId: 'user-123',
  customColumns: {
    organizationId: 'org-456',
    tenantId: 'tenant-789',
  },
});

// Filter threads efficiently by custom column
const result = await memory.listThreads({
  filter: {
    customColumns: { organizationId: 'org-456' },
  },
});
```

Fixes #11076
