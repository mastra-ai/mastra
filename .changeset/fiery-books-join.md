---
'@mastra/dynamodb': minor
---

Adds configurable TTL (Time To Live) support for `DynamoDBStore`, enabling automatic data expiration for different entity types.

Fixes #8185

**Usage:**

```ts
import { DynamoDBStore, type DynamoDBStoreConfig } from '@mastra/dynamodb';

const config: DynamoDBStoreConfig = {
  id: 'my-store',
  tableName: 'mastra-table',
  region: 'us-east-1',
  ttl: {
    message: { enabled: true, defaultTtlSeconds: 86400 },      // 1 day
    trace: { enabled: true, defaultTtlSeconds: 604800 },       // 7 days
    workflow_snapshot: { enabled: true, defaultTtlSeconds: 2592000 }, // 30 days
  },
};

const store = new DynamoDBStore({ name: 'dynamodb', config });
```

**Key changes:**
- Added `ttl` configuration option to `DynamoDBStoreConfig` with per-entity settings
- Supported entities: `thread`, `message`, `resource`, `trace`, `eval`, `workflow_snapshot`, `score`
- Added typed entity data interfaces (`ThreadEntityData`, `MessageEntityData`, etc.)
- Updated documentation with usage examples and AWS setup instructions
