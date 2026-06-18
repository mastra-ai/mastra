# @mastra/spanner

Google Cloud Spanner storage adapter for Mastra. Implements the GoogleSQL dialect.

## Installation

```bash
npm install @mastra/spanner
```

## Prerequisites

- A Cloud Spanner instance and database created with the GoogleSQL dialect.
- Application credentials available to the Node.js client (Application Default Credentials, service account JSON, or `GOOGLE_APPLICATION_CREDENTIALS`).
- For local development, the [Spanner emulator](https://cloud.google.com/spanner/docs/emulator) running on `localhost:9010`.

## Usage

### Connecting to a managed Cloud Spanner database

```typescript
import { SpannerStore } from '@mastra/spanner';

const store = new SpannerStore({
  id: 'spanner-storage',
  projectId: 'my-gcp-project',
  instanceId: 'my-instance',
  databaseId: 'mastra',
});
```

### Connecting to the Spanner emulator

```typescript
process.env.SPANNER_EMULATOR_HOST = 'localhost:9010';

const store = new SpannerStore({
  id: 'spanner-storage',
  projectId: 'test-project',
  instanceId: 'test-instance',
  databaseId: 'test-db',
  // Skip auth checks when talking to the emulator
  spannerOptions: { servicePath: 'localhost', port: 9010, sslCreds: undefined },
});
```

The store automatically detects the `SPANNER_EMULATOR_HOST` env var and uses
unauthenticated channels when set. You can also create the instance/database
through the emulator using the standard `gcloud` CLI.

### Pre-configured client or database

If you already manage a Spanner client elsewhere, pass the database directly:

```typescript
import { Spanner } from '@google-cloud/spanner';
import { SpannerStore } from '@mastra/spanner';

const spanner = new Spanner({ projectId: 'my-project' });
const database = spanner.instance('my-instance').database('mastra');

const store = new SpannerStore({
  id: 'spanner-storage',
  database,
});
```

## Notes on the GoogleSQL dialect

- Tables are created with the GoogleSQL dialect using `STRING(MAX)` for text/JSON
  payloads, `INT64`, `FLOAT64`, `BOOL` and `TIMESTAMP`.
- DDL is applied through `database.updateSchema(...)` (long-running operation).
- Upserts use `INSERT OR UPDATE`. Deletes use `DELETE WHERE TRUE` (Spanner has no
  `TRUNCATE`).
- Identifiers are quoted with backticks.
- The adapter does not use named schemas. Use a dedicated database for isolation.

## Storage domains

The adapter implements the following storage domains:

- `memory`: threads, messages, resources
- `workflows`: workflow snapshots and run state
- `scores`: evaluation scores
- `backgroundTasks`: background tool execution state
- `agents`: thin agent records and versioned config snapshots
- `mcpClients`: MCP client configurations with version history
- `mcpServers`: MCP server configurations with version history
- `skills`: skill records and versioned skill snapshots
- `blobs`: content-addressable blob store (used by the skills domain)
- `promptBlocks`: prompt block records and versioned template/rules snapshots
- `scorerDefinitions`: scorer definition records and versioned scoring-config snapshots
- `schedules`: cron-driven workflow schedules and trigger history (consumed by `WorkflowScheduler`)
- `observability`: AI tracing spans (per-trace and per-span records) used by the Studio traces UI

## Testing locally with the emulator

Start the emulator:

```bash
docker compose up -d
```

Then run the tests:

```bash
ENABLE_TESTS=true pnpm test
```
