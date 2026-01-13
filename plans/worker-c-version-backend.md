# Worker C: Version Storage + Server

> **Role**: All versioning backend infrastructure  
> **Priority**: HIGH - Enables version history feature  
> **Status**: IN PROGRESS

---

## Overview

Worker C builds the entire backend infrastructure for agent versioning: database schema, storage domain implementations, server routes, and client SDK methods.

---

## Dependencies

- **V1, V6**: ✅ COMPLETE
- **V2-V4**: Ready to start (schema complete)
- **V5, V7**: Depend on V2-V4 (storage domain)
- **V8**: Depends on V5 (server routes)

---

## ✅ COMPLETED Tasks

### Task V1: Add `TABLE_AGENT_VERSIONS` Schema ✅

**Status**: COMPLETE (PR #11849)

**File**: `packages/core/src/storage/constants.ts`

**Add table constant**:

```typescript
export const TABLE_AGENT_VERSIONS = 'mastra_agent_versions';
```

**Update TABLE_NAMES type**:

```typescript
export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES
  | typeof TABLE_RESOURCES
  | typeof TABLE_SCORERS
  | typeof TABLE_SPANS
  | typeof TABLE_AGENTS
  | typeof TABLE_AGENT_VERSIONS; // ADD THIS
```

**Add schema**:

```typescript
export const AGENT_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true }, // ULID
  agentId: { type: 'text', nullable: false },
  versionNumber: { type: 'integer', nullable: false },
  name: { type: 'text', nullable: true }, // Vanity name
  snapshot: { type: 'jsonb', nullable: false }, // Full agent config
  changedFields: { type: 'jsonb', nullable: true }, // Array of field names
  changeMessage: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};
```

**Add to TABLE_SCHEMAS**:

```typescript
export const TABLE_SCHEMAS: Record<TABLE_NAMES, Record<string, StorageColumn>> = {
  // ... existing schemas
  [TABLE_AGENT_VERSIONS]: AGENT_VERSIONS_SCHEMA,
};
```

---

### Task V6: Add `activeVersionId` to Agents Schema ✅

**Status**: COMPLETE (PR #11849)

**File**: `packages/core/src/storage/constants.ts`

**Modify AGENTS_SCHEMA**:

```typescript
export const AGENTS_SCHEMA: Record<string, StorageColumn> = {
  // ... existing fields
  activeVersionId: { type: 'text', nullable: true }, // ADD THIS - FK to agent_versions.id
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};
```

**File**: `packages/core/src/storage/types.ts`

**Update StorageAgentType**:

```typescript
export interface StorageAgentType {
  // ... existing fields
  activeVersionId?: string; // ADD THIS
}
```

---

### Task V2: Create AgentVersionsStorage Base Class ✅

**Status**: COMPLETE (PR #11858)

**New file**: `packages/core/src/storage/domains/agent-versions/base.ts`

```typescript
import { StorageDomain } from '../base';
import type { StorageAgentType } from '../../types';

export interface AgentVersion {
  id: string; // ULID
  agentId: string;
  versionNumber: number;
  name?: string;
  snapshot: StorageAgentType;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: Date;
}

export interface CreateVersionInput {
  id: string;
  agentId: string;
  versionNumber: number;
  name?: string;
  snapshot: StorageAgentType;
  changedFields?: string[];
  changeMessage?: string;
}

export interface ListVersionsInput {
  agentId: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    field: 'versionNumber' | 'createdAt';
    direction: 'ASC' | 'DESC';
  };
}

export interface ListVersionsOutput {
  versions: AgentVersion[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export abstract class AgentVersionsStorage extends StorageDomain {
  abstract createVersion(input: CreateVersionInput): Promise<AgentVersion>;
  abstract getVersion(id: string): Promise<AgentVersion | null>;
  abstract getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null>;
  abstract getLatestVersion(agentId: string): Promise<AgentVersion | null>;
  abstract listVersions(input: ListVersionsInput): Promise<ListVersionsOutput>;
  abstract deleteVersion(id: string): Promise<void>;
  abstract deleteVersionsByAgentId(agentId: string): Promise<void>;
  abstract countVersions(agentId: string): Promise<number>;
}
```

**New file**: `packages/core/src/storage/domains/agent-versions/index.ts`

```typescript
export * from './base';
export * from './inmemory';
```

---

### Task V3: Create In-Memory Implementation ✅

**Status**: COMPLETE (PR #11858)

**New file**: `packages/core/src/storage/domains/agent-versions/inmemory.ts`

```typescript
import { AgentVersionsStorage, AgentVersion, CreateVersionInput, ListVersionsInput, ListVersionsOutput } from './base';

export class InMemoryAgentVersionsStorage extends AgentVersionsStorage {
  #versions: Map<string, AgentVersion> = new Map();

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    const version: AgentVersion = {
      ...input,
      createdAt: new Date(),
    };
    this.#versions.set(input.id, version);
    return version;
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    return this.#versions.get(id) || null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    for (const version of this.#versions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return version;
      }
    }
    return null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    let latest: AgentVersion | null = null;
    for (const version of this.#versions.values()) {
      if (version.agentId === agentId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 1, perPage = 20, orderBy } = input;

    let versions = Array.from(this.#versions.values()).filter(v => v.agentId === agentId);

    // Sort
    const field = orderBy?.field || 'versionNumber';
    const direction = orderBy?.direction || 'DESC';
    versions.sort((a, b) => {
      const aVal = field === 'createdAt' ? a.createdAt.getTime() : a.versionNumber;
      const bVal = field === 'createdAt' ? b.createdAt.getTime() : b.versionNumber;
      return direction === 'DESC' ? bVal - aVal : aVal - bVal;
    });

    const total = versions.length;
    const start = (page - 1) * perPage;
    const paginatedVersions = versions.slice(start, start + perPage);

    return {
      versions: paginatedVersions,
      total,
      page,
      perPage,
      hasMore: start + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.#versions.delete(id);
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    for (const [id, version] of this.#versions.entries()) {
      if (version.agentId === agentId) {
        this.#versions.delete(id);
      }
    }
  }

  async countVersions(agentId: string): Promise<number> {
    let count = 0;
    for (const version of this.#versions.values()) {
      if (version.agentId === agentId) count++;
    }
    return count;
  }
}
```

---

### Task V4: Create PostgreSQL Implementation ✅

**Status**: COMPLETE (PR #11858)

**New file**: `stores/pg/src/storage/domains/agent-versions/index.ts`

```typescript
import {
  AgentVersionsStorage,
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage/domains/agent-versions';
import { TABLE_AGENT_VERSIONS } from '@mastra/core/storage/constants';
import type { PgDB } from '../../db';

export class PgAgentVersionsStorage extends AgentVersionsStorage {
  #db: PgDB;
  #schemaName: string;

  constructor(db: PgDB, schemaName: string = 'public') {
    super();
    this.#db = db;
    this.#schemaName = schemaName;
  }

  get #tableName() {
    return `"${this.#schemaName}"."${TABLE_AGENT_VERSIONS}"`;
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    const now = new Date();
    const sql = `
      INSERT INTO ${this.#tableName} 
        (id, "agentId", "versionNumber", name, snapshot, "changedFields", "changeMessage", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.#db.client.one(sql, [
      input.id,
      input.agentId,
      input.versionNumber,
      input.name || null,
      JSON.stringify(input.snapshot),
      input.changedFields ? JSON.stringify(input.changedFields) : null,
      input.changeMessage || null,
      now,
    ]);
    return this.#mapRow(result);
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    const sql = `SELECT * FROM ${this.#tableName} WHERE id = $1`;
    const result = await this.#db.client.oneOrNone(sql, [id]);
    return result ? this.#mapRow(result) : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    const sql = `SELECT * FROM ${this.#tableName} WHERE "agentId" = $1 AND "versionNumber" = $2`;
    const result = await this.#db.client.oneOrNone(sql, [agentId, versionNumber]);
    return result ? this.#mapRow(result) : null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    const sql = `
      SELECT * FROM ${this.#tableName} 
      WHERE "agentId" = $1 
      ORDER BY "versionNumber" DESC 
      LIMIT 1
    `;
    const result = await this.#db.client.oneOrNone(sql, [agentId]);
    return result ? this.#mapRow(result) : null;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 1, perPage = 20, orderBy } = input;
    const field = orderBy?.field === 'createdAt' ? '"createdAt"' : '"versionNumber"';
    const direction = orderBy?.direction || 'DESC';
    const offset = (page - 1) * perPage;

    const countSql = `SELECT COUNT(*) FROM ${this.#tableName} WHERE "agentId" = $1`;
    const countResult = await this.#db.client.one(countSql, [agentId]);
    const total = parseInt(countResult.count, 10);

    const sql = `
      SELECT * FROM ${this.#tableName}
      WHERE "agentId" = $1
      ORDER BY ${field} ${direction}
      LIMIT $2 OFFSET $3
    `;
    const results = await this.#db.client.manyOrNone(sql, [agentId, perPage, offset]);

    return {
      versions: results.map(r => this.#mapRow(r)),
      total,
      page,
      perPage,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.#tableName} WHERE id = $1`;
    await this.#db.client.none(sql, [id]);
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    const sql = `DELETE FROM ${this.#tableName} WHERE "agentId" = $1`;
    await this.#db.client.none(sql, [agentId]);
  }

  async countVersions(agentId: string): Promise<number> {
    const sql = `SELECT COUNT(*) FROM ${this.#tableName} WHERE "agentId" = $1`;
    const result = await this.#db.client.one(sql, [agentId]);
    return parseInt(result.count, 10);
  }

  #mapRow(row: any): AgentVersion {
    return {
      id: row.id,
      agentId: row.agentId,
      versionNumber: row.versionNumber,
      name: row.name || undefined,
      snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
      changedFields: row.changedFields
        ? typeof row.changedFields === 'string'
          ? JSON.parse(row.changedFields)
          : row.changedFields
        : undefined,
      changeMessage: row.changeMessage || undefined,
      createdAt: new Date(row.createdAt),
    };
  }
}
```

---

### Task V5: Add Version Server Routes & Handlers ✅

**Status**: COMPLETE (PR #11863)

**New file**: `packages/server/src/server/schemas/agent-versions.ts`

```typescript
import { z } from 'zod';

export const agentVersionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  versionNumber: z.number(),
  name: z.string().optional(),
  snapshot: z.record(z.string(), z.unknown()),
  changedFields: z.array(z.string()).optional(),
  changeMessage: z.string().optional(),
  createdAt: z.string(),
});

export const listVersionsQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  perPage: z.coerce.number().optional().default(20),
  orderBy: z.enum(['versionNumber', 'createdAt']).optional(),
  orderDirection: z.enum(['ASC', 'DESC']).optional(),
});

export const createVersionBodySchema = z.object({
  name: z.string().max(100).optional(),
  changeMessage: z.string().max(500).optional(),
});

export const compareVersionsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});
```

**New file**: `packages/server/src/server/handlers/agent-versions.ts`

Implement routes:

- `GET /api/stored/agents/:agentId/versions` - List versions
- `POST /api/stored/agents/:agentId/versions` - Create version
- `GET /api/stored/agents/:agentId/versions/:versionId` - Get version
- `POST /api/stored/agents/:agentId/versions/:versionId/activate` - Activate
- `POST /api/stored/agents/:agentId/versions/:versionId/restore` - Restore
- `DELETE /api/stored/agents/:agentId/versions/:versionId` - Delete
- `GET /api/stored/agents/:agentId/versions/compare` - Compare two versions

**Helper functions needed**:

- `generateULID()` - Use `ulid` package
- `calculateChangedFields(previous, current)` - Deep compare agent configs
- `enforceRetentionLimit(agentId, maxVersions)` - Delete old versions

---

### Task V7: Update `getStoredAgent` for Version Resolution

**Priority**: HIGH
**Status**: TODO
**Depends on**: V2-V4

**File**: `packages/core/src/mastra/index.ts`

Modify `getStoredAgent` to accept optional version parameter:

```typescript
public async getStoredAgent(
  id: string,
  options?: { versionId?: string; versionNumber?: number }
): Promise<Agent | null> {
  // ... existing code to get agent

  if (options?.versionId) {
    const versionsStore = this.getStore('agentVersions');
    const version = await versionsStore.getVersion(options.versionId);
    if (version) {
      return this.#createAgentFromStoredConfig(version.snapshot);
    }
  }

  if (options?.versionNumber) {
    const versionsStore = this.getStore('agentVersions');
    const version = await versionsStore.getVersionByNumber(id, options.versionNumber);
    if (version) {
      return this.#createAgentFromStoredConfig(version.snapshot);
    }
  }

  // ... existing fallback to current config
}
```

---

### Task V8: Add Version Methods to Client SDK

**Priority**: HIGH
**Status**: TODO
**Depends on**: V5

**File**: `client-sdks/client-js/src/types.ts`

Add types:

```typescript
export interface AgentVersionResponse {
  id: string;
  agentId: string;
  versionNumber: number;
  name?: string;
  snapshot: StoredAgentResponse;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

export interface ListAgentVersionsParams {
  page?: number;
  perPage?: number;
  orderBy?: 'versionNumber' | 'createdAt';
  orderDirection?: 'ASC' | 'DESC';
}

export interface ListAgentVersionsResponse {
  versions: AgentVersionResponse[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface CreateAgentVersionParams {
  name?: string;
  changeMessage?: string;
}

export interface AgentVersionDiff {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
}

export interface CompareVersionsResponse {
  diffs: AgentVersionDiff[];
  fromVersion: AgentVersionResponse;
  toVersion: AgentVersionResponse;
}
```

**File**: `client-sdks/client-js/src/resources/stored-agent.ts`

Add methods to `StoredAgentResource`:

```typescript
async listVersions(params?: ListAgentVersionsParams): Promise<ListAgentVersionsResponse>
async createVersion(params?: CreateAgentVersionParams): Promise<AgentVersionResponse>
async getVersion(versionId: string): Promise<AgentVersionResponse>
async activateVersion(versionId: string): Promise<void>
async restoreVersion(versionId: string): Promise<AgentVersionResponse>
async deleteVersion(versionId: string): Promise<void>
async compareVersions(fromId: string, toId: string): Promise<CompareVersionsResponse>
```

---

## File Ownership

Worker C owns exclusively:

- `packages/core/src/storage/constants.ts` (version schema additions)
- `packages/core/src/storage/domains/agent-versions/*` (all new)
- `packages/server/src/server/schemas/agent-versions.ts` (new)
- `packages/server/src/server/handlers/agent-versions.ts` (new)
- `stores/pg/src/storage/domains/agent-versions/*` (new)
- `client-sdks/client-js/src/resources/stored-agent.ts` (version methods)

**Shared with Worker A**:

- `client-sdks/client-js/src/types.ts` - A adds source, C adds version types

---

## Handoff

After completing V8:

- Notify Worker D that client SDK version methods are ready
- Worker D can now build `useAgentVersions` hooks

---

## Testing Checklist

- [x] `TABLE_AGENT_VERSIONS` schema is correct
- [x] `activeVersionId` added to agents schema
- [x] Schema migration for `activeVersionId` in storage adapters
- [x] In-memory storage implementation complete
- [x] PostgreSQL storage implementation complete
- [ ] `POST /api/stored/agents/:id/versions` creates version
- [ ] `GET /api/stored/agents/:id/versions` lists versions
- [ ] `GET /api/stored/agents/:id/versions/:versionId` returns version
- [ ] `POST .../activate` sets active version
- [ ] `POST .../restore` creates new version from snapshot
- [ ] `DELETE .../versions/:versionId` deletes (unless active)
- [ ] `GET .../compare?from=X&to=Y` returns diffs
- [ ] Client SDK methods work
- [ ] `getStoredAgent(id, { versionId })` resolves correct version
