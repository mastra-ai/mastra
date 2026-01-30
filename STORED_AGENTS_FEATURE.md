# Stored Agents / Agent CMS Feature - Current State

This document captures the full implementation of the stored agents feature (also referred to as "agent CMS" or "agent draft/publish"). This is an experimental, unreleased feature. Breaking changes are acceptable.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Storage Layer](#storage-layer)
4. [Mastra Core Integration](#mastra-core-integration)
5. [Server API Routes](#server-api-routes)
6. [Client SDK](#client-sdk)
7. [Playground UI](#playground-ui)
8. [Auto-Versioning System](#auto-versioning-system)
9. [Key Files Reference](#key-files-reference)

---

## Architecture Overview

The stored agents feature allows agents to be defined in a database (not just in code) and managed via CRUD APIs. Key concepts:

- **Stored Agent**: An agent configuration persisted to database (table: `mastra_agents`)
- **Agent Version**: An immutable snapshot of an agent config at a point in time (table: `mastra_agent_versions`)
- **Active Version**: The `activeVersionId` field on the agent record points to the currently "published" version
- **Version Resolution**: `getAgentByIdResolved()` returns the snapshot from the active version (if set), not the raw agent record
- **Reference Resolution**: Tools, workflows, sub-agents, memory, and scorers are stored as string keys and resolved at runtime from Mastra's registries

The system does NOT have explicit "draft" and "published" states. Instead, the current agent record is always editable, and versions are immutable snapshots. The `activeVersionId` determines which snapshot is served when the agent is fetched.

### Data Flow

```
User edits agent via API/UI
  -> PATCH /stored/agents/:id (updates agent record)
  -> handleAutoVersioning() detects changed fields
  -> Creates new version snapshot with retry logic
  -> Sets activeVersionId to new version
  -> Clears in-memory agent cache

User fetches agent
  -> GET /stored/agents/:id
  -> agentsStore.getAgentByIdResolved({ id })
  -> If activeVersionId is set, returns snapshot from that version
  -> Otherwise returns raw agent record
```

---

## Database Schema

### Table: `mastra_agents`

Defined in `packages/core/src/storage/constants.ts:91-111` as `AGENTS_SCHEMA`:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text | NOT NULL (PK) | Unique identifier |
| `name` | text | NOT NULL | Display name |
| `description` | text | nullable | Purpose description |
| `instructions` | text | NOT NULL | System instructions/prompt |
| `model` | jsonb | NOT NULL | Model config: `{ provider, name, ...config }` |
| `tools` | jsonb | nullable | Array of tool keys (string[]) |
| `defaultOptions` | jsonb | nullable | Default generate/stream options |
| `workflows` | jsonb | nullable | Array of workflow keys (string[]) |
| `agents` | jsonb | nullable | Array of sub-agent keys (string[]) |
| `integrationTools` | jsonb | nullable | Integration tool IDs (`provider_toolkit_tool` format) |
| `inputProcessors` | jsonb | nullable | Input processor configs |
| `outputProcessors` | jsonb | nullable | Output processor configs |
| `memory` | jsonb | nullable | Memory reference key |
| `scorers` | jsonb | nullable | Scorer configs with sampling |
| `metadata` | jsonb | nullable | Arbitrary metadata |
| `ownerId` | text | nullable | Multi-tenant owner identifier |
| `activeVersionId` | text | nullable | FK to `mastra_agent_versions.id` |
| `createdAt` | timestamp | NOT NULL | Creation timestamp |
| `updatedAt` | timestamp | NOT NULL | Last update timestamp |

### Table: `mastra_agent_versions`

Defined in `packages/core/src/storage/constants.ts:113-122` as `AGENT_VERSIONS_SCHEMA`:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text | NOT NULL (PK) | UUID identifier |
| `agentId` | text | NOT NULL | FK to `mastra_agents.id` |
| `versionNumber` | integer | NOT NULL | Sequential (1, 2, 3...) |
| `name` | text | nullable | Vanity name (max 100 chars) |
| `snapshot` | jsonb | NOT NULL | Full agent config at this point |
| `changedFields` | jsonb | nullable | Array of field names that changed |
| `changeMessage` | text | nullable | Description of changes (max 500 chars) |
| `createdAt` | timestamp | NOT NULL | Creation timestamp |

---

## Storage Layer

### TypeScript Types

Defined in `packages/core/src/storage/types.ts:238-320`:

```typescript
interface StorageAgentType {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: Record<string, unknown>;      // { provider, name, ...config }
  tools?: string[];                     // Tool keys to resolve
  defaultOptions?: Record<string, unknown>;
  workflows?: string[];                 // Workflow keys to resolve
  agents?: string[];                    // Sub-agent keys to resolve
  integrationTools?: string[];          // Format: "provider_toolkitSlug_toolSlug"
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: string;                      // Memory key to resolve
  scorers?: Record<string, StorageScorerConfig>;
  metadata?: Record<string, unknown>;
  ownerId?: string;                     // Multi-tenant filtering
  activeVersionId?: string;             // FK to agent_versions.id
  createdAt: Date;
  updatedAt: Date;
}

type StorageCreateAgentInput = Omit<StorageAgentType, 'createdAt' | 'updatedAt'>;

type StorageUpdateAgentInput = {
  id: string;
  // All other fields optional
  name?: string; description?: string; instructions?: string;
  model?: Record<string, unknown>; tools?: string[];
  // ... etc
  activeVersionId?: string;
};
```

### AgentVersion Type

Defined in `packages/core/src/storage/domains/agents/base.ts:20-37`:

```typescript
interface AgentVersion {
  id: string;           // UUID
  agentId: string;      // FK to agents.id
  versionNumber: number; // Sequential (1, 2, 3...)
  name?: string;        // Optional vanity name
  snapshot: StorageAgentType; // Full config snapshot
  changedFields?: string[];  // Fields that changed
  changeMessage?: string;    // Change description
  createdAt: Date;
}
```

### Abstract Base Class: `AgentsStorage`

Defined in `packages/core/src/storage/domains/agents/base.ts:128-330`.

**Agent CRUD (abstract):**
- `getAgentById({ id })` - Raw fetch, no version resolution
- `createAgent({ agent })` - Create new agent
- `updateAgent({ id, ...updates })` - Update (selective fields)
- `deleteAgent({ id })` - Delete agent (cascades to versions)
- `listAgents(args?)` - Paginated list with ordering, ownerId, metadata filters

**Concrete methods (on base class):**
- `getAgentByIdResolved({ id })` - Fetches agent, then if `activeVersionId` is set, returns the version's snapshot instead (with `id` and `activeVersionId` preserved from the agent record)
- `listAgentsResolved(args?)` - Same but for listing

**Version methods (abstract):**
- `createVersion(input)` - Create immutable version snapshot
- `getVersion(id)` - Fetch version by UUID
- `getVersionByNumber(agentId, versionNumber)` - Fetch by sequential number
- `getLatestVersion(agentId)` - Highest version number
- `listVersions(input)` - Paginated, sortable by `versionNumber` or `createdAt`
- `deleteVersion(id)` - Delete one version
- `deleteVersionsByAgentId(agentId)` - Delete all versions for an agent
- `countVersions(agentId)` - Count versions

**Helper methods (protected):**
- `parseOrderBy(orderBy?, defaultDirection?)` - Validates/normalizes agent sort
- `parseVersionOrderBy(orderBy?, defaultDirection?)` - Validates/normalizes version sort

### Implementations

1. **InMemoryAgentsStorage** (`packages/core/src/storage/domains/agents/inmemory.ts`)
   - Uses `Map<string, StorageAgentType>` and `Map<string, AgentVersion>`
   - Deep clones on read/write to prevent mutation
   - Validates unique (agentId, versionNumber) pairs
   - Deleting an agent cascades to delete its versions

2. **PostgreSQL** (`stores/pg/src/storage/domains/agents/index.ts`)
   - Class: `AgentsPG extends AgentsStorage`
   - Two tables: `mastra_agents` and `mastra_agent_versions`
   - JSON parsing for JSONB fields

3. **MongoDB** (`stores/mongodb/src/storage/domains/agents/index.ts`)
   - Indexes: agent `id` (unique), `createdAt`, `updatedAt`; version `id` (unique), `(agentId, versionNumber)` composite unique, `(agentId, createdAt)`

4. **LibSQL** (`stores/libsql/src/storage/domains/agents/index.ts`)

### Storage Domain Registration

The agents domain is registered in `MastraCompositeStore` alongside other domains (`packages/core/src/storage/base.ts:196-201`):

```typescript
this.stores = {
  memory: ...,
  workflows: ...,
  scores: ...,
  observability: ...,
  agents: ...,  // AgentsStorage implementation
};
```

Accessed via `storage.getStore('agents')`.

---

## Mastra Core Integration

### `Mastra.getStoredAgentById()`

Defined in `packages/core/src/mastra/index.ts:781-878`. Three overloads:

```typescript
// Returns Agent instance (default)
getStoredAgentById(id: string, options?: { raw?: false; versionId?: string; versionNumber?: number }): Promise<Agent | null>

// Returns raw StorageAgentType
getStoredAgentById(id: string, options: { raw: true; versionId?: string; versionNumber?: number }): Promise<StorageAgentType | null>
```

**Behavior:**
1. If `versionId` provided: fetch that specific version, verify it belongs to the agent
2. If `versionNumber` provided: fetch version by agent ID + number
3. Otherwise: use `getAgentByIdResolved()` (returns active version snapshot if set)
4. Non-raw requests are cached in `#storedAgentsCache` (Map)
5. Cache can be cleared with `clearStoredAgentCache(id)`

### `Mastra.listStoredAgents()`

Defined at `packages/core/src/mastra/index.ts:891-1015`. Returns paginated list of Agent instances (or raw configs).

### `#createAgentFromStoredConfig()`

Defined at `packages/core/src/mastra/index.ts:1021-1085`. Converts `StorageAgentType` to a live `Agent` instance:

1. Validates model config has `provider` and `name`
2. Builds model string as `"{provider}/{name}"` (model router format)
3. Resolves tools via `#resolveStoredTools()` - looks up by key/ID in Mastra's tool registry
4. Resolves workflows via `#resolveStoredWorkflows()` - looks up by key then by ID
5. Resolves sub-agents via `#resolveStoredAgents()` - looks up by key then by ID
6. Resolves memory via `#resolveStoredMemory()` - looks up by key then by ID
7. Resolves scorers via `#resolveStoredScorers()` - looks up by key then by ID, includes sampling config
8. Creates `new Agent({...})` with resolved primitives
9. Registers the agent with Mastra (logger, storage, agents, tts, vectors)
10. Sets `agent.source = 'stored'` (used by UI to show edit button)

**Missing primitive handling:** If a referenced tool/workflow/agent/memory/scorer is not registered in Mastra, a warning is logged but execution continues. The agent is created without the missing primitive.

---

## Server API Routes

All routes defined in:
- `packages/server/src/server/handlers/stored-agents.ts`
- `packages/server/src/server/handlers/agent-versions.ts`

Route registration in `packages/server/src/server/server-adapter/routes/stored-agents.ts`.

### Stored Agent CRUD

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/stored/agents` | `LIST_STORED_AGENTS_ROUTE` | List all stored agents (paginated) |
| GET | `/stored/agents/:storedAgentId` | `GET_STORED_AGENT_ROUTE` | Get agent by ID (resolved from active version) |
| POST | `/stored/agents` | `CREATE_STORED_AGENT_ROUTE` | Create new stored agent |
| PATCH | `/stored/agents/:storedAgentId` | `UPDATE_STORED_AGENT_ROUTE` | Update agent (triggers auto-versioning) |
| DELETE | `/stored/agents/:storedAgentId` | `DELETE_STORED_AGENT_ROUTE` | Delete agent and clear cache |

**Query params for LIST:**
- `page` (number, default 0)
- `perPage` (number, default 100)
- `orderBy` ({ field: 'createdAt' | 'updatedAt', direction: 'ASC' | 'DESC' })
- `ownerId` (string) - filter by owner
- `metadata` (Record<string, unknown>) - filter by metadata

**CREATE body:** All agent fields + required `id`
**UPDATE body:** All agent fields, all optional (partial update)

**Important:** The UPDATE handler calls `handleAutoVersioning()` after updating, which creates a new version if fields changed and sets `activeVersionId`.

**All stored agent routes require auth** (`requiresAuth: true`).

### Agent Version Routes

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/stored/agents/:agentId/versions` | `LIST_AGENT_VERSIONS_ROUTE` | List versions (paginated) |
| POST | `/stored/agents/:agentId/versions` | `CREATE_AGENT_VERSION_ROUTE` | Create manual version snapshot |
| GET | `/stored/agents/:agentId/versions/compare` | `COMPARE_AGENT_VERSIONS_ROUTE` | Compare two versions |
| GET | `/stored/agents/:agentId/versions/:versionId` | `GET_AGENT_VERSION_ROUTE` | Get specific version |
| POST | `/stored/agents/:agentId/versions/:versionId/activate` | `ACTIVATE_AGENT_VERSION_ROUTE` | Set version as active |
| POST | `/stored/agents/:agentId/versions/:versionId/restore` | `RESTORE_AGENT_VERSION_ROUTE` | Restore from old version |
| DELETE | `/stored/agents/:agentId/versions/:versionId` | `DELETE_AGENT_VERSION_ROUTE` | Delete version (not active) |

**Route ordering matters:** The `compare` route (literal path) must come before `/:versionId` (param path) in the route array.

**Activation:** Sets `activeVersionId` on the agent record. Simple pointer update.

**Restore:** Applies the old version's snapshot to the agent record, creates a new version from the result, sets that as active. Change message: `"Restored from version N (name)"`.

**Delete constraint:** Cannot delete the active version (returns 400).

**Compare:** Returns `{ diffs: [{field, previousValue, currentValue}], fromVersion, toVersion }`.

---

## Client SDK

### StoredAgent Resource

Defined in `client-sdks/client-js/src/resources/stored-agent.ts`:

```typescript
class StoredAgent extends BaseResource {
  constructor(options: ClientOptions, storedAgentId: string)

  // Agent CRUD
  details(requestContext?): Promise<StoredAgentResponse>
  update(params, requestContext?): Promise<StoredAgentResponse>
  delete(requestContext?): Promise<DeleteStoredAgentResponse>

  // Version methods
  listVersions(params?, requestContext?): Promise<ListAgentVersionsResponse>
  createVersion(params?, requestContext?): Promise<AgentVersionResponse>
  getVersion(versionId, requestContext?): Promise<AgentVersionResponse>
  activateVersion(versionId, requestContext?): Promise<ActivateAgentVersionResponse>
  restoreVersion(versionId, requestContext?): Promise<AgentVersionResponse>
  deleteVersion(versionId, requestContext?): Promise<DeleteAgentVersionResponse>
  compareVersions(fromId, toId, requestContext?): Promise<CompareVersionsResponse>
}
```

### Client Types

Defined in `client-sdks/client-js/src/types.ts:589-699`:

```typescript
interface StoredAgentScorerConfig {
  sampling?: { type: 'ratio' | 'count'; rate?: number; count?: number; };
}

interface StoredAgentResponse {
  id: string; name: string; description?: string; instructions: string;
  model: Record<string, unknown>; tools?: string[];
  integrationTools?: string[]; defaultOptions?: Record<string, unknown>;
  workflows?: string[]; agents?: string[];
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: string; scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}

interface ListStoredAgentsParams {
  page?: number; perPage?: number;
  orderBy?: { field?: 'createdAt' | 'updatedAt'; direction?: 'ASC' | 'DESC'; };
}

interface ListStoredAgentsResponse {
  agents: StoredAgentResponse[]; total: number;
  page: number; perPage: number | false; hasMore: boolean;
}

interface CreateStoredAgentParams {
  id: string; name: string; description?: string; instructions: string;
  model: Record<string, unknown>; tools?: string[];
  // ... all agent fields
  ownerId?: string;
}

interface UpdateStoredAgentParams {
  // All fields optional
  name?: string; instructions?: string; model?: Record<string, unknown>;
  // ... etc
}

interface AgentVersionResponse {
  id: string; agentId: string; versionNumber: number;
  name?: string; snapshot: Record<string, any>;
  changedFields?: string[]; changeMessage?: string; createdAt: string;
}

interface ActivateAgentVersionResponse {
  success: boolean; message: string; activeVersionId: string;
}

interface CompareVersionsResponse {
  fromVersion: AgentVersionResponse; toVersion: AgentVersionResponse;
  diffs: VersionDiff[];
}
```

---

## Playground UI

### React Hooks

Defined in `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts`:

| Hook | Purpose | React Query Key |
|------|---------|-----------------|
| `useAgentVersions({ agentId, params? })` | List versions | `['agent-versions', agentId, params, requestContext]` |
| `useAgentVersion({ agentId, versionId })` | Get single version | `['agent-version', agentId, versionId, requestContext]` |
| `useCreateAgentVersion({ agentId })` | Create version (mutation) | Invalidates `agent-versions` and `agent` |
| `useActivateAgentVersion({ agentId })` | Activate version (mutation) | Invalidates `agent-versions` and `agent` |
| `useRestoreAgentVersion({ agentId })` | Restore version (mutation) | Invalidates `agent-versions` and `agent` |
| `useDeleteAgentVersion({ agentId })` | Delete version (mutation) | Invalidates `agent-versions` |
| `useCompareAgentVersions({ agentId, fromVersionId, toVersionId })` | Compare versions | `['agent-versions-compare', ...]` |

All hooks use `useMastraClient()` and pass `requestContext` from `usePlaygroundStore()`.

### UI Components

Located in `packages/playground-ui/src/domains/agents/components/agent-versions/`:

- **`agent-versions-list.tsx`** - Lists versions with active badge, activate/delete buttons, save version dialog, compare dialog
- **`save-version-dialog.tsx`** - Form dialog: name input (max 100), change message textarea (max 500)
- **`version-compare-dialog.tsx`** - Side-by-side version diff display

---

## Auto-Versioning System

Defined in `packages/server/src/server/handlers/agent-versions.ts:274-318`.

### `handleAutoVersioning(agentsStore, agentId, existingAgent, updatedAgent)`

Called automatically by the UPDATE stored agent handler after every update:

1. **Calculate changed fields**: Compares existing vs updated config using `deepEqual()`, skipping `createdAt`/`updatedAt`
2. **Skip if no changes**: Returns early with `versionCreated: false`
3. **Create version with retry**: Calls `createVersionWithRetry()` with change message `"Auto-saved after edit"`
4. **Update activeVersionId**: Sets the agent's `activeVersionId` to the new version
5. **Enforce retention**: Deletes oldest versions if count exceeds 50 (default)

### `createVersionWithRetry(agentsStore, agentId, snapshot, changedFields, options?)`

Handles race conditions on version creation:

1. Fetches latest version number, increments by 1
2. Generates UUID for version ID
3. Creates the version
4. On unique constraint violation (duplicate versionNumber): retries up to 3 times with increasing delay (10ms, 20ms, 30ms)

### `enforceRetentionLimit(agentsStore, agentId, activeVersionId, maxVersions=50)`

1. Counts total versions; returns if under limit
2. Fetches oldest versions (by versionNumber ASC)
3. Deletes oldest versions until under limit, never deleting the active version

### `calculateChangedFields(previous, current)`

Deep comparison using `deepEqual()` from `@mastra/core/utils`. Skips `createdAt`/`updatedAt`. Returns array of field names that differ.

### `computeVersionDiffs(fromSnapshot, toSnapshot)`

Returns `Array<{ field, previousValue, currentValue }>` for all differing fields.

---

## Key Files Reference

### Core Types and Storage

| File | Purpose |
|------|---------|
| `packages/core/src/storage/types.ts:238-320` | `StorageAgentType`, `StorageCreateAgentInput`, `StorageUpdateAgentInput`, `StorageScorerConfig` |
| `packages/core/src/storage/constants.ts:91-122` | `AGENTS_SCHEMA`, `AGENT_VERSIONS_SCHEMA` table definitions |
| `packages/core/src/storage/domains/agents/base.ts` | `AgentsStorage` abstract class, `AgentVersion` type, all version types |
| `packages/core/src/storage/domains/agents/inmemory.ts` | `InMemoryAgentsStorage` implementation |
| `packages/core/src/storage/base.ts:120-240` | `MastraCompositeStore` with `getStore('agents')` |

### Mastra Integration

| File | Purpose |
|------|---------|
| `packages/core/src/mastra/index.ts:781-878` | `getStoredAgentById()` with version resolution and caching |
| `packages/core/src/mastra/index.ts:891-1015` | `listStoredAgents()` |
| `packages/core/src/mastra/index.ts:1021-1085` | `#createAgentFromStoredConfig()` - converts stored config to Agent instance |
| `packages/core/src/mastra/index.ts:1091-1220` | `#resolveStoredTools/Workflows/Agents/Memory/Scorers()` |
| `packages/core/src/mastra/stored-agents.test.ts` | Unit tests |

### Server Handlers and Schemas

| File | Purpose |
|------|---------|
| `packages/server/src/server/handlers/stored-agents.ts` | CRUD routes for stored agents |
| `packages/server/src/server/handlers/agent-versions.ts` | Version routes + auto-versioning logic |
| `packages/server/src/server/schemas/stored-agents.ts` | Zod schemas for agent API |
| `packages/server/src/server/schemas/agent-versions.ts` | Zod schemas for version API |
| `packages/server/src/server/server-adapter/routes/stored-agents.ts` | Route registration array |

### Client SDK

| File | Purpose |
|------|---------|
| `client-sdks/client-js/src/resources/stored-agent.ts` | `StoredAgent` resource class with all CRUD + version methods |
| `client-sdks/client-js/src/types.ts:589-699` | Client-side types |

### Playground UI

| File | Purpose |
|------|---------|
| `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts` | React Query hooks for versions |
| `packages/playground-ui/src/domains/agents/components/agent-versions/agent-versions-list.tsx` | Version list UI |
| `packages/playground-ui/src/domains/agents/components/agent-versions/save-version-dialog.tsx` | Manual version creation dialog |
| `packages/playground-ui/src/domains/agents/components/agent-versions/version-compare-dialog.tsx` | Version comparison UI |

### Storage Adapter Implementations

| File | Purpose |
|------|---------|
| `stores/pg/src/storage/domains/agents/index.ts` | PostgreSQL implementation |
| `stores/mongodb/src/storage/domains/agents/index.ts` | MongoDB implementation |
| `stores/libsql/src/storage/domains/agents/index.ts` | LibSQL implementation |

---

## Design Notes and Observations

1. **No explicit draft state**: The system uses "active version" rather than draft/published states. The current agent record can be thought of as the "draft" and the active version as the "published" state, but this is implicit.

2. **Primitives are references, not values**: Tools, workflows, agents, memory, and scorers are stored as string keys. They must be registered in the Mastra instance at runtime to be resolved. Missing references log warnings but don't fail.

3. **Model storage**: Models are stored as `{ provider, name, ...config }` and reconstructed as `"{provider}/{name}"` string for the model router.

4. **Caching**: `getStoredAgentById()` caches Agent instances in a Map. Cache is invalidated on update/delete. Cache is bypassed for raw requests and version-specific requests.

5. **Auto-versioning on every edit**: Every PATCH to a stored agent automatically creates a new version if any fields changed. This means version history grows automatically.

6. **Retention limit**: Default 50 versions per agent. Oldest versions are pruned automatically, but the active version is never deleted.

7. **Race condition handling**: Version creation uses retry logic with exponential backoff to handle concurrent version number conflicts.

8. **Source marker**: Agents created from storage have `agent.source = 'stored'` set, which the UI uses to decide whether to show the edit button.

9. **The `agent-builder` package is unrelated**: Despite the similar naming, `@mastra/agent-builder` is a meta-agent for code generation, not the stored agent CMS feature.
