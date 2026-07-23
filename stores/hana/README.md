# @mastra/hana

SAP HANA Cloud and S/4HANA DB implementation for Mastra, providing general storage capabilities using the `@sap/hana-client` native driver with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/hana @sap/hana-client
```

## Prerequisites

- SAP HANA Cloud or S/4HANA DB instance
- Database user with privileges to create tables, schemas, and indexes

## Usage

### Storage

#### Basic Configuration

**1. Host/Port/Credentials**

```typescript
import { HANAStore } from '@mastra/hana';

const store = new HANAStore({
  id: 'hana-storage',
  host: 'your-hana-cloud-host.hanacloud.ondemand.com',
  port: 443,
  uid: 'DBUSER',
  pwd: 'yourPassword',
});
```

**2. JDBC Connection String**

```typescript
const store = new HANAStore({
  id: 'hana-storage',
  connectionString: 'jdbc:sap://your-host:443?uid=DBUSER&pwd=yourPassword&encrypt=true',
});
```

**3. Bring Your Own Pool**

```typescript
import { HANAStore } from '@mastra/hana';
import { HANAPool } from '@mastra/hana/pool';

const pool = new HANAPool({
  host: 'your-hana-cloud-host.hanacloud.ondemand.com',
  port: 443,
  uid: 'DBUSER',
  pwd: 'yourPassword',
  min: 2,
  max: 20,
});

const store = new HANAStore({ id: 'hana-storage', pool });
```

#### Advanced Options

```typescript
const store = new HANAStore({
  id: 'hana-storage',
  host: 'your-hana-cloud-host.hanacloud.ondemand.com',
  port: 443,
  uid: 'DBUSER',
  pwd: 'yourPassword',
  databaseName: 'MYTENANTDB', // For multi-tenant deployments
  encrypt: true, // Default true for port 443
  sslValidateCertificate: true, // Enable for production
  schemaName: 'MASTRA', // Custom schema (default: none)
  poolMin: 2,
  poolMax: 20,
  skipDefaultIndexes: false,
  indexes: [
    // Additional custom indexes
    { name: 'my_custom_idx', table: 'mastra_threads', columns: ['resourceId'] },
  ],
});
```

#### Usage Example

```typescript
import { Mastra } from '@mastra/core';
import { HANAStore } from '@mastra/hana';

const store = new HANAStore({
  id: 'hana-storage',
  host: process.env.HANA_HOST!,
  port: Number(process.env.HANA_PORT ?? 443),
  uid: process.env.HANA_USER!,
  pwd: process.env.HANA_PASSWORD!,
});

const mastra = new Mastra({ storage: store });

// Initialize (creates tables and indexes)
await mastra.getStorage()?.init();

// Save a thread
await store.saveThread({
  thread: {
    id: 'thread-123',
    resourceId: 'resource-456',
    title: 'My Thread',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  },
});

// Get a thread
const thread = await store.getThreadById({ threadId: 'thread-123' });
```

### SAP BTP / HANA Cloud Connection

For SAP BTP deployments, use the VCAP_SERVICES credentials:

```typescript
const vcap = JSON.parse(process.env.VCAP_SERVICES ?? '{}');
const hanaService = vcap['hana']?.[0]?.credentials;

const store = new HANAStore({
  id: 'hana-storage',
  host: hanaService.host,
  port: hanaService.port,
  uid: hanaService.user,
  pwd: hanaService.password,
  databaseName: hanaService.database,
  encrypt: true,
  sslValidateCertificate: true,
});
```

## Configuration Options

| Option                   | Type                   | Default           | Description                                     |
| ------------------------ | ---------------------- | ----------------- | ----------------------------------------------- |
| `host`                   | `string`               | —                 | HANA Cloud hostname                             |
| `port`                   | `number`               | —                 | Port (typically `443` for HANA Cloud)           |
| `uid`                    | `string`               | —                 | Database user                                   |
| `pwd`                    | `string`               | —                 | Database password                               |
| `databaseName`           | `string`               | —                 | Tenant database name (multi-tenant deployments) |
| `encrypt`                | `boolean`              | `true` (port 443) | Enable TLS encryption                           |
| `sslValidateCertificate` | `boolean`              | `false`           | Validate server TLS certificate                 |
| `schemaName`             | `string`               | —                 | Custom schema name for table isolation          |
| `poolMin`                | `number`               | `1`               | Minimum idle connections in the pool            |
| `poolMax`                | `number`               | `10`              | Maximum connections in the pool                 |
| `skipDefaultIndexes`     | `boolean`              | `false`           | Skip creating default indexes                   |
| `indexes`                | `CreateIndexOptions[]` | —                 | Additional custom indexes to create on `init()` |
| `disableInit`            | `boolean`              | `false`           | Skip automatic table creation on first use      |

## Notes

- Do **not** commit credentials. Use environment variables or SAP BTP service bindings.
- `@sap/hana-client` is a native Node.js addon. The build step requires `node-gyp` and platform build tools.
- This adapter does **not** include vector storage. For vector capabilities, see the `@mastra/hana-vector` adapter (coming soon).
