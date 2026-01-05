---
"@mastra/pg": patch
---

Added `exportSchemas()` function to generate Mastra database schema as SQL DDL without a database connection.

**What's New**

You can now export your Mastra database schema as SQL DDL statements without connecting to a database. This is useful for:

- Generating migration scripts
- Reviewing the schema before deployment
- Creating database schemas in environments where the application doesn't have CREATE privileges

**Example**

```typescript
import { exportSchemas } from '@mastra/pg';

// Export schema for default 'public' schema
const ddl = exportSchemas();
console.log(ddl);

// Export schema for a custom schema
const customDdl = exportSchemas('my_schema');
// Creates: CREATE SCHEMA IF NOT EXISTS "my_schema"; and all tables within it
```
