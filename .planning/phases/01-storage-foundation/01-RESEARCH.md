# Phase 1: Storage Foundation - Research

**Researched:** 2026-01-23
**Domain:** Mastra Storage Domain Pattern
**Confidence:** HIGH

## Summary

Researched Mastra's existing storage domain patterns by analyzing the core storage infrastructure. The codebase follows a consistent domain-based architecture where each storage domain (memory, workflows, scores, observability, agents) extends a base `StorageDomain` class with abstract methods for CRUD operations. Backends (LibSQL, PostgreSQL, in-memory) implement these abstract classes.

The pattern is well-established: define a base class in `packages/core/src/storage/domains/{name}/base.ts`, implement in-memory version in same folder, define table schema in `constants.ts`, and external stores implement the same interface in their own packages. Auto-versioning will require atomic increment operations during item mutations.

**Primary recommendation:** Follow the existing ScoresStorage pattern exactly - create DatasetsStorage base class, define TABLE_DATASETS and TABLE_DATASET_ITEMS schemas, implement DatasetsInMemory, and add to StorageDomains type.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | internal | Base storage abstractions | Provides StorageDomain, MastraCompositeStore |
| @libsql/client | ^0.x | LibSQL/Turso client | Standard for SQLite-compatible storage |
| zod | ^3.x | Schema validation | Already used for type-safe schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto | built-in | UUID generation | `crypto.randomUUID()` for IDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auto-increment version | Explicit version control | Auto simpler UX (decided) |
| Separate version table | Version column on dataset | Column simpler, sufficient |

**Installation:**
```bash
# No new packages needed - uses existing @mastra/core infrastructure
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/storage/
├── domains/
│   ├── datasets/
│   │   ├── base.ts           # DatasetsStorage abstract class
│   │   ├── inmemory.ts       # DatasetsInMemory implementation
│   │   └── index.ts          # Re-exports
│   └── index.ts              # Add datasets export
├── constants.ts              # Add TABLE_DATASETS, TABLE_DATASET_ITEMS
└── types.ts                  # Add Dataset types

stores/libsql/src/storage/
├── domains/
│   └── datasets/
│       └── index.ts          # DatasetsLibSQL implementation
└── index.ts                  # Add DatasetsLibSQL export
```

### Pattern 1: StorageDomain Base Class
**What:** Abstract base class all storage domains extend
**When to use:** Every storage domain implementation
**Example:**
```typescript
// Source: packages/core/src/storage/domains/base.ts
export abstract class StorageDomain extends MastraBase {
  async init(): Promise<void> {
    // Default no-op - adapters override if they need to create tables
  }
  abstract dangerouslyClearAll(): Promise<void>;
}
```

### Pattern 2: Domain-Specific Abstract Class
**What:** Defines domain contract with abstract CRUD methods
**When to use:** Each domain (scores, workflows, datasets)
**Example:**
```typescript
// Source: packages/core/src/storage/domains/scores/base.ts
export abstract class ScoresStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'SCORES' });
  }
  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;
  abstract saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }>;
  // ...more abstract methods
}
```

### Pattern 3: InMemoryDB Shared State
**What:** Shared Maps container for in-memory implementation
**When to use:** All in-memory domain implementations share one InMemoryDB
**Example:**
```typescript
// Source: packages/core/src/storage/domains/inmemory-db.ts
export class InMemoryDB {
  readonly threads = new Map<string, StorageThreadType>();
  readonly scores = new Map<string, ScoreRowData>();
  // Add: datasets, datasetItems
}
```

### Pattern 4: Schema Definition in Constants
**What:** Define StorageColumn schemas in constants.ts
**When to use:** Every new table needs schema definition
**Example:**
```typescript
// Source: packages/core/src/storage/constants.ts
export const TABLE_DATASETS = 'mastra_datasets';
export const DATASETS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  version: { type: 'integer', nullable: false },
  // ...
};
```

### Pattern 5: Pagination Response Structure
**What:** Standard pagination info returned from list operations
**When to use:** All list methods
**Example:**
```typescript
// Source: packages/core/src/storage/types.ts
export type PaginationInfo = {
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
};
```

### Anti-Patterns to Avoid
- **Direct Map access:** Always access via domain methods, not db.maps directly
- **Skipping init():** Always call init() before operations; creates tables
- **Missing dangerouslyClearAll:** Required for testing; implement in every domain
- **Inconsistent pagination:** Use normalizePerPage() and calculatePagination() utilities

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID logic | `crypto.randomUUID()` | Standard, secure |
| Pagination math | Manual offset calc | `normalizePerPage()`, `calculatePagination()` | Handles edge cases (false = all) |
| JSON parsing | Simple JSON.parse | `safelyParseJSON()` | Handles already-parsed objects |
| Date handling | Manual conversion | `ensureDate()`, `serializeDate()` | Consistent Date/string handling |
| Error IDs | Manual string concat | `createStorageErrorId()` | Consistent error format |
| SQL type mapping | Switch statements | `getSqlType()` | Consistent across backends |

**Key insight:** The storage layer has well-tested utilities. Use them rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Version Race Conditions
**What goes wrong:** Two concurrent item updates both read version 1, both write version 2
**Why it happens:** Read-modify-write without atomicity
**How to avoid:** Use `UPDATE ... SET version = version + 1` atomically, or lock at dataset level
**Warning signs:** Tests with concurrent operations produce wrong version numbers

### Pitfall 2: Missing Table Registrations
**What goes wrong:** Table not created on init(), queries fail
**Why it happens:** Forgot to add table to TABLE_NAMES, TABLE_SCHEMAS, or init() method
**How to avoid:**
1. Add TABLE_DATASETS constant
2. Add to TABLE_NAMES type union
3. Add DATASETS_SCHEMA
4. Add to TABLE_SCHEMAS map
5. Call createTable in init()
**Warning signs:** "Table does not exist" errors

### Pitfall 3: Inconsistent JSON Storage
**What goes wrong:** Objects stored inconsistently, can't query properly
**Why it happens:** LibSQL stores JSON as TEXT, needs stringify/parse
**How to avoid:** Always use `jsonb` type in schema, use safelyParseJSON on read
**Warning signs:** `[object Object]` in database or parse errors

### Pitfall 4: Breaking InMemoryDB Contract
**What goes wrong:** Tests fail because in-memory doesn't match real backend
**Why it happens:** In-memory implementation diverges from contract
**How to avoid:** Test both backends with same test suite
**Warning signs:** Tests pass with in-memory, fail with LibSQL

### Pitfall 5: Items Without Dataset FK
**What goes wrong:** Orphaned items, can't query items by dataset
**Why it happens:** Missing foreign key relationship
**How to avoid:** Items must have datasetId, query items via dataset
**Warning signs:** Items exist but can't be found by dataset

## Code Examples

Verified patterns from Mastra codebase:

### Creating a New Domain Base Class
```typescript
// Source: packages/core/src/storage/domains/scores/base.ts pattern
import { StorageDomain } from '../base';

export abstract class DatasetsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'DATASETS' });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  abstract createDataset(dataset: CreateDatasetInput): Promise<Dataset>;
  abstract getDatasetById(args: { id: string }): Promise<Dataset | null>;
  abstract updateDataset(args: UpdateDatasetInput): Promise<Dataset>;
  abstract deleteDataset(args: { id: string }): Promise<void>;
  abstract listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput>;

  // Item operations
  abstract addItem(args: AddItemInput): Promise<DatasetItem>;
  abstract updateItem(args: UpdateItemInput): Promise<DatasetItem>;
  abstract deleteItem(args: { id: string; datasetId: string }): Promise<void>;
  abstract listItems(args: ListItemsInput): Promise<ListItemsOutput>;
  abstract getItemsByVersion(args: { datasetId: string; version: number }): Promise<DatasetItem[]>;
}
```

### In-Memory Implementation Pattern
```typescript
// Source: packages/core/src/storage/domains/scores/inmemory.ts pattern
import type { InMemoryDB } from '../inmemory-db';
import { DatasetsStorage } from './base';

export class DatasetsInMemory extends DatasetsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.datasets.clear();
    this.db.datasetItems.clear();
  }

  async createDataset(input: CreateDatasetInput): Promise<Dataset> {
    const id = crypto.randomUUID();
    const now = new Date();
    const dataset = {
      ...input,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.db.datasets.set(id, dataset);
    return dataset;
  }

  // Auto-version on item change
  async addItem(args: AddItemInput): Promise<DatasetItem> {
    const dataset = this.db.datasets.get(args.datasetId);
    if (!dataset) throw new Error('Dataset not found');

    // Increment version atomically
    const newVersion = dataset.version + 1;
    this.db.datasets.set(args.datasetId, { ...dataset, version: newVersion, updatedAt: new Date() });

    const item = {
      id: crypto.randomUUID(),
      datasetId: args.datasetId,
      version: newVersion,
      input: args.input,
      expectedOutput: args.expectedOutput,
      context: args.context,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.db.datasetItems.set(item.id, item);
    return item;
  }
}
```

### LibSQL Implementation Pattern
```typescript
// Source: stores/libsql/src/storage/domains/scores/index.ts pattern
import { DatasetsStorage, TABLE_DATASETS, DATASETS_SCHEMA } from '@mastra/core/storage';
import { LibSQLDB } from '../../db';

export class DatasetsLibSQL extends DatasetsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, ...config });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_DATASETS, schema: DATASETS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_DATASET_ITEMS, schema: DATASET_ITEMS_SCHEMA });
  }

  async addItem(args: AddItemInput): Promise<DatasetItem> {
    // Atomic version increment in SQL
    await this.#client.execute({
      sql: `UPDATE ${TABLE_DATASETS} SET version = version + 1, updatedAt = ? WHERE id = ?`,
      args: [new Date().toISOString(), args.datasetId],
    });

    const result = await this.#client.execute({
      sql: `SELECT version FROM ${TABLE_DATASETS} WHERE id = ?`,
      args: [args.datasetId],
    });
    const newVersion = Number(result.rows[0]?.version);

    // Insert item with new version
    const id = crypto.randomUUID();
    await this.#db.insert({
      tableName: TABLE_DATASET_ITEMS,
      record: {
        id,
        datasetId: args.datasetId,
        version: newVersion,
        input: JSON.stringify(args.input),
        expectedOutput: args.expectedOutput ? JSON.stringify(args.expectedOutput) : null,
        context: args.context ? JSON.stringify(args.context) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    return { id, datasetId: args.datasetId, version: newVersion, ...args, createdAt: new Date(), updatedAt: new Date() };
  }
}
```

### Schema Definition Pattern
```typescript
// Source: packages/core/src/storage/constants.ts pattern
export const TABLE_DATASETS = 'mastra_datasets';
export const TABLE_DATASET_ITEMS = 'mastra_dataset_items';

export const DATASETS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  metadata: { type: 'jsonb', nullable: true },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const DATASET_ITEMS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  version: { type: 'integer', nullable: false },  // Version when item was added/modified
  input: { type: 'jsonb', nullable: false },
  expectedOutput: { type: 'jsonb', nullable: true },
  context: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};
```

### Registration in StorageDomains
```typescript
// Source: packages/core/src/storage/base.ts pattern
export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
  datasets?: DatasetsStorage;  // Add new domain
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct DB access | Domain abstraction | Current | Pluggable backends |
| MastraStorage | MastraCompositeStore | Recent | Better composition |

**Deprecated/outdated:**
- `MastraStorage`: Use `MastraCompositeStore` instead (alias exists for backwards compat)

## Open Questions

Things that couldn't be fully resolved:

1. **Item Soft Delete vs Hard Delete**
   - What we know: Current patterns use hard delete
   - What's unclear: Should deleted items affect version? Preserve for audit?
   - Recommendation: Start with hard delete (simpler), version increments on delete

2. **Version Query Semantics**
   - What we know: Items have version when created/modified
   - What's unclear: Get items "as of version N" vs "added in version N"
   - Recommendation: Query by version returns items at or before that version (snapshot semantics)

3. **Batch Operations**
   - What we know: LibSQL supports batch() for multiple operations
   - What's unclear: Should adding multiple items be one version bump or many?
   - Recommendation: Single version bump for batch add (atomic operation)

## Sources

### Primary (HIGH confidence)
- `packages/core/src/storage/domains/base.ts` - StorageDomain base class
- `packages/core/src/storage/domains/scores/base.ts` - ScoresStorage pattern
- `packages/core/src/storage/domains/scores/inmemory.ts` - In-memory implementation
- `packages/core/src/storage/domains/inmemory-db.ts` - Shared in-memory state
- `packages/core/src/storage/constants.ts` - Schema definitions
- `packages/core/src/storage/base.ts` - MastraCompositeStore, StorageDomains
- `stores/libsql/src/storage/index.ts` - LibSQLStore implementation
- `stores/libsql/src/storage/domains/scores/index.ts` - ScoresLibSQL
- `stores/libsql/src/storage/db/index.ts` - LibSQLDB helper class

### Secondary (MEDIUM confidence)
- `packages/core/src/storage/utils.ts` - Utility functions
- `packages/core/src/storage/types.ts` - Type definitions

### Tertiary (LOW confidence)
- None - all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct codebase analysis
- Architecture: HIGH - multiple consistent examples in codebase
- Pitfalls: HIGH - derived from code patterns and common issues

**Research date:** 2026-01-23
**Valid until:** 60 days (internal patterns are stable)
