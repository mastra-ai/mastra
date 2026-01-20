# @mastra/convex

## 1.0.0-beta.10

### Major Changes

- Mark as stable ([#12096](https://github.com/mastra-ai/mastra/pull/12096))

### Patch Changes

- Fixed ConvexStore so storage.getStore(domain) works properly, preventing runtime errors in flows that access domain stores. ([#12065](https://github.com/mastra-ai/mastra/pull/12065))
  Added no-op schema methods (createTable, alterTable) to keep storage migrations compatible with Convex's declarative schema.
  Relates to `#11361`.

- Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version. ([#12093](https://github.com/mastra-ai/mastra/pull/12093))

  **Migration:**

  Update your imports and usage:

  ```typescript
  // Before
  import { MastraStorage } from '@mastra/core/storage';

  const storage = new MastraStorage({
    id: 'composite',
    domains: { ... }
  });

  // After
  import { MastraCompositeStore } from '@mastra/core/storage';

  const storage = new MastraCompositeStore({
    id: 'composite',
    domains: { ... }
  });
  ```

  The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897)]:
  - @mastra/core@1.0.0-beta.26

## 0.1.0-beta.9

### Patch Changes

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/core@1.0.0-beta.25

## 0.1.0-beta.8

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries. ([#11479](https://github.com/mastra-ai/mastra/pull/11479))

  **What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

  **Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

  **Example:**

  ```typescript
  // Get first page
  const page1 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });

  // Get next page using cursor-based pagination
  const oldestMessage = page1.messages[page1.messages.length - 1];
  const page2 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
    filter: {
      dateRange: {
        end: oldestMessage.createdAt,
        endExclusive: true, // Excludes the cursor message
      },
    },
  });
  ```

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20

## 0.1.0-beta.7

### Patch Changes

- Add storage composition to MastraStorage ([#11401](https://github.com/mastra-ai/mastra/pull/11401))

  `MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

  ```typescript
  import { MastraStorage } from '@mastra/core/storage';
  import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
  import { MemoryLibSQL } from '@mastra/libsql';

  // Compose domains from different stores
  const storage = new MastraStorage({
    id: 'composite',
    domains: {
      memory: new MemoryLibSQL({ url: 'file:./local.db' }),
      workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
      scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
    },
  });
  ```

  **Breaking changes:**
  - `storage.supports` property no longer exists
  - `StorageSupports` type is no longer exported from `@mastra/core/storage`

  All stores now support the same features. For domain availability, use `getStore()`:

  ```typescript
  const store = await storage.getStore('memory');
  if (store) {
    // domain is available
  }
  ```

- Updated dependencies [[`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f)]:
  - @mastra/core@1.0.0-beta.16

## 0.1.0-beta.6

### Minor Changes

- Introduce StorageDomain base class for composite storage support ([#11249](https://github.com/mastra-ai/mastra/pull/11249))

  Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

  **Key changes:**
  - Add `StorageDomain` abstract base class that all domain storage classes extend
  - Add `InMemoryDB` class for shared state across in-memory domain implementations
  - All storage domains now implement `dangerouslyClearAll()` for test cleanup
  - Remove `operations` from public `StorageDomains` type (now internal to each adapter)
  - Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

  **Why this matters:**

  This enables composite storage where you can use different database adapters per domain:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { PostgresStore } from '@mastra/pg';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Use Postgres for most domains but Clickhouse for observability
  const mastra = new Mastra({
    storage: new PostgresStore({
      connectionString: 'postgres://...',
    }),
    // Future: override specific domains
    // observability: new ClickhouseStore({ ... }).getStore('observability'),
  });
  ```

  **Standalone domain usage:**

  Domains can now be used independently with flexible configuration:

  ```typescript
  import { MemoryLibSQL } from '@mastra/libsql/memory';

  // Option 1: Pass config to create client internally
  const memory = new MemoryLibSQL({
    url: 'file:./local.db',
  });

  // Option 2: Pass existing client for shared connections
  import { createClient } from '@libsql/client';
  const client = createClient({ url: 'file:./local.db' });
  const memory = new MemoryLibSQL({ client });
  ```

  **Breaking changes:**
  - `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
  - Domain base classes now require implementing `dangerouslyClearAll()` method

- Refactor storage architecture to use domain-specific stores via `getStore()` pattern ([#11361](https://github.com/mastra-ai/mastra/pull/11361))

  ### Summary

  This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

  ### Migration Guide

  All direct method calls on storage instances should be updated to use `getStore()`:

  ```typescript
  // Before
  const thread = await storage.getThreadById({ threadId });
  await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  await storage.createSpan(span);

  // After
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });

  const workflows = await storage.getStore('workflows');
  await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

  const observability = await storage.getStore('observability');
  await observability?.createSpan(span);
  ```

  ### Available Domains
  - **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
  - **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
  - **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
  - **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
  - **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

  ### Breaking Changes
  - Passthrough methods have been removed from `MastraStorage` base class
  - All storage adapters now require accessing domains via `getStore()`
  - The `stores` property on storage instances is now the canonical way to access domain storage

  ### Internal Changes
  - Each storage adapter now initializes domain-specific stores in its constructor
  - Domain stores share database connections and handle their own table initialization

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

### Patch Changes

- Fix missing `title` field in Convex threads table schema ([#11356](https://github.com/mastra-ai/mastra/pull/11356))

  The Convex schema was hardcoded and out of sync with the core `TABLE_SCHEMAS`, causing errors when creating threads:

  ```
  Error: Failed to insert or update a document in table "mastra_threads"
  because it does not match the schema: Object contains extra field `title`
  that is not in the validator.
  ```

  Now the Convex schema dynamically builds from `TABLE_SCHEMAS` via a new `@mastra/core/storage/constants` export path that doesn't pull in Node.js dependencies (safe for Convex's sandboxed schema evaluation).

  ```typescript
  // Users can now import schema tables without Node.js dependency issues
  import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema';

  export default defineSchema({
    mastra_threads: mastraThreadsTable,
    mastra_messages: mastraMessagesTable,
  });
  ```

  Fixes #11319

- Added pre-configured client support for all storage adapters. ([#11302](https://github.com/mastra-ai/mastra/pull/11302))

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

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/core@1.0.0-beta.15

## 0.1.0-beta.5

### Minor Changes

- Fixed Convex schema exports to support import in `convex/schema.ts` files. ([#11242](https://github.com/mastra-ai/mastra/pull/11242))

  Previously, importing table definitions from `@mastra/convex/server` failed in Convex schema files because it transitively imported Node.js runtime modules (`crypto`, `fs`, `path`) that are unavailable in Convex's deploy-time sandbox.

  **Changes**
  - Added new export path `@mastra/convex/schema` that provides table definitions without runtime dependencies
  - Moved schema definitions to a separate `src/schema.ts` file
  - Updated `@mastra/convex/server` to re-export schema definitions from the new location for backward compatibility

  **Migration**

  Users should now import schema tables from `@mastra/convex/schema` instead of `@mastra/convex/server` in their `convex/schema.ts` files:

  ```ts
  // Before
  import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/server';

  // After
  import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema';
  ```

### Patch Changes

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14

## 0.1.0-beta.4

### Patch Changes

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))

  Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

  **Before:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom error properties were lost
    console.log(result.error); // "Step execution failed" (just a string)
  }
  ```

  **After:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom properties are preserved
    console.log(result.error.message); // "Step execution failed"
    console.log(result.error.statusCode); // 429
    console.log(result.error.cause?.name); // "RateLimitError"
  }
  ```

  **Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

  Other changes:
  - Added `UpdateWorkflowStateOptions` type for workflow state updates

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176)]:
  - @mastra/core@1.0.0-beta.12

## 0.1.0-beta.3

### Patch Changes

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10

## 0.1.0-beta.2

### Patch Changes

- Fix saveScore not persisting ID correctly, breaking getScoreById retrieval ([#10915](https://github.com/mastra-ai/mastra/pull/10915))

  **What Changed**
  - saveScore now correctly returns scores that can be retrieved with getScoreById
  - Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

  **Impact**
  Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8

## 0.1.0-beta.1

### Minor Changes

- Add `disableInit` option to all storage adapters ([#10851](https://github.com/mastra-ai/mastra/pull/10851))

  Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

  ```typescript
  // CI/CD script - run migrations
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
  });
  await storage.init();

  // Runtime - skip auto-init
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
    disableInit: true,
  });
  ```

### Patch Changes

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7

## 0.0.2-beta.0

### Patch Changes

- feat(storage): support querying messages from multiple threads ([#10663](https://github.com/mastra-ai/mastra/pull/10663))
  - Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type
  - Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
  - Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
  - **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

- Convex storage and vector adapter improvements: ([#10421](https://github.com/mastra-ai/mastra/pull/10421))
  - Refactored to use typed Convex tables for each Mastra domain (threads, messages, resources, workflows, scorers, vectors)
  - All tables now include `id` field for Mastra record ID and `by_record_id` index for efficient lookups
  - Fixed 32k document limit issues by using batched operations and indexed queries
  - Updated `saveMessages` and `updateMessages` to automatically update thread `updatedAt` timestamps
  - Fixed `listMessages` to properly fetch messages from different threads when using `include`
  - Fixed `saveResource` to preserve `undefined` metadata instead of converting to empty object
  - Rewrote `ConvexAdminClient` to use Convex HTTP API directly with proper admin authentication
  - Added comprehensive documentation for storage and vector adapters
  - Exported pre-built table definitions from `@mastra/convex/server` for easy schema setup

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6

## Unreleased

- Initial release.
