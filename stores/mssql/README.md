# @mastra/mssql

Microsoft SQL Server storage implementation for Mastra.

## Installation

```bash
npm install @mastra/mssql
```

## Prerequisites

- Microsoft SQL Server 2016 or higher
- User with privileges to create tables and schemas

## Quick Start

```typescript
import { MSSQLStore } from '@mastra/mssql';
import { Mastra } from '@mastra/core/mastra';

// Initialize MSSQLStore
const storage = new MSSQLStore({
  id: 'my-storage-id',
  connectionString:
    'Server=localhost,1433;Database=mastra;User Id=sa;Password=password;Encrypt=true;TrustServerCertificate=true',
  // Or use: server, port, database, user, password
});

// Configure Mastra
const mastra = new Mastra({
  storage: storage,
});

// Access domain stores
const memoryStore = await storage.getStore('memory');
const workflowsStore = await storage.getStore('workflows');
const evalsStore = await storage.getStore('evals');
const observabilityStore = await storage.getStore('observability');
```

## Configuration

### Connection Methods

1. **Connection String** (Recommended)

   ```typescript
   {
     connectionString: 'Server=localhost,1433;Database=mastra;User Id=sa;Password=password;Encrypt=true;TrustServerCertificate=true';
   }
   ```

2. **Server/Port/Database**
   ```typescript
   {
     server: 'localhost',
     port: 1433,
     database: 'mastra',
     user: 'sa',
     password: 'password',
     options: { encrypt: true, trustServerCertificate: true },
   }
   ```

### Optional Configuration

- `schemaName`: Custom schema name (default: `dbo`)

## Documentation

For complete documentation, see:

- [Storage Overview](https://mastra.ai/docs/v1/server-db/storage) - Learn about storage domains and composite storage
- [Memory Domain Reference](https://mastra.ai/reference/v1/storage-domains/memory) - Threads, messages, and resources API
- [Workflows Domain Reference](https://mastra.ai/reference/v1/storage-domains/workflows) - Workflow snapshots and runs API
- [Evals Domain Reference](https://mastra.ai/reference/v1/storage-domains/evals) - Evaluation scores API
- [Observability Domain Reference](https://mastra.ai/reference/v1/storage-domains/observability) - Traces and spans API

## Related Links

- [Microsoft SQL Server Documentation](https://docs.microsoft.com/sql/)
