---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added pre-configured client support for all storage adapters.

**What changed**

All storage adapters now accept pre-configured database clients in addition to connection credentials. This allows you to customize client settings (connection pools, timeouts, interceptors) before passing them to Mastra.

**Example**

```typescript
import { createClient } from '@clickhouse/client';
import { ClickhouseStore } from '@mastra/clickhouse';

// Create and configure client with custom settings
const client = createClient({
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  request_timeout: 60000,
});

// Pass pre-configured client to store
const store = new ClickhouseStore({
  id: 'my-store',
  client,
});
```

**Additional improvements**

- Added input validation for required connection parameters (URL, credentials) with clear error messages
