---
"@mastra/pg": minor
"@mastra/libsql": minor
"@mastra/cloudflare-d1": minor
---

Add Drizzle ORM integration

Use Drizzle ORM for type-safe database queries alongside existing store APIs.

**Usage:**

```typescript
import { createMastraSchema } from '@mastra/pg/drizzle'; // or libsql, cloudflare-d1
import { drizzle } from 'drizzle-orm/node-postgres'; // or libsql, d1
import { eq } from 'drizzle-orm';

const { mastraThreads } = createMastraSchema();
const db = drizzle(connection);
const threads = await db.select().from(mastraThreads).where(eq(mastraThreads.resourceId, 'user-123'));
```

**Factory options:**

- PostgreSQL: `createMastraSchema({ schemaName? })` - supports custom PostgreSQL schemas
- D1: `createMastraSchema({ tablePrefix? })` - supports table name prefixes for environment isolation
- LibSQL: `createMastraSchema()` - no options (tablePrefix not supported by LibSQLStore)

**What's included:**

- Export Drizzle schemas via `@mastra/{pg,libsql,cloudflare-d1}/drizzle`
- Unified `createMastraSchema()` factory API across all stores
- `drizzle-orm` as optional peer dependency
- `generate:drizzle` scripts for schema regeneration
- CI workflow to validate schemas stay in sync
