<background>
You are a senior TypeScript developer working on the Mastra framework stored agents feature (agent CMS). This is an unreleased experimental feature -- breaking changes are acceptable.

The goal is to restructure the data model so the agent record becomes a thin metadata-only record and ALL config (including name and description) lives exclusively in version snapshot rows.

Key architectural decisions:
- Agent record fields: id, status ('draft' or 'published'), activeVersionId, authorId, metadata, createdAt, updatedAt
- Version snapshot fields: name, description, instructions, model, tools, defaultOptions, workflows, agents, integrationTools, inputProcessors, outputProcessors, memory (Record<string, unknown> -- changed from string key), scorers
- name and description MOVE from the agent record INTO version snapshots (they can change between versions)
- id is immutable and stays on the agent record only
- status is a NEW field: 'draft' on creation, 'published' when a version is activated
- memory type changes from string to Record<string, unknown> (it is an object config, not a simple key)
- A new StorageAgentSnapshotType replaces the reuse of StorageAgentType for version snapshots
- RENAME: ownerId is renamed to authorId everywhere (types, schema, storage, queries, filters). This better reflects the field's purpose. Update all references across the affected files.
- The AGENT_VERSIONS_SCHEMA table should NO LONGER have a single snapshot jsonb column. Instead, the config fields (name, description, instructions, model, tools, defaultOptions, workflows, agents, integrationTools, inputProcessors, outputProcessors, memory, scorers) should be TOP-LEVEL columns on the versions table alongside the version metadata fields (id, agentId, versionNumber, changedFields, changeMessage, createdAt). The version row IS the snapshot -- there is no nested snapshot object. The old 'name' column on versions (previously a vanity name for the version) is REMOVED -- the agent config 'name' field replaces it as a top-level column.
- These type changes will cascade across multiple packages (core, stores, server, client SDK). Fix all downstream compile errors and ensure the full monorepo builds cleanly.

Read STORED_AGENTS_FEATURE.md in the repo root for full feature context before starting.
</background>

<setup>
1. Read STORED_AGENTS_FEATURE.md for full context on current implementation
2. Read packages/core/src/storage/types.ts -- focus on StorageAgentType (lines 257-293), StorageCreateAgentInput, StorageUpdateAgentInput, StorageScorerConfig, and related types
3. Read packages/core/src/storage/constants.ts -- focus on AGENTS_SCHEMA (lines 91-111) and AGENT_VERSIONS_SCHEMA (lines 113-121)
4. Read packages/core/src/storage/domains/agents/base.ts -- full file, especially AgentVersion interface (lines 20-37), AgentsStorage abstract class (line 128+), getAgentByIdResolved (lines 155-176), CreateVersionInput, ListVersionsInput, ListVersionsOutput types
5. Understand the exports -- check how these types are re-exported from index files
</setup>

<tasks>
1. In packages/core/src/storage/types.ts, create a new StorageAgentSnapshotType interface with ALL config fields: name (string), description (optional string), instructions (string), model (Record<string, unknown>), tools (optional string[]), defaultOptions (optional Record<string, unknown>), workflows (optional string[]), agents (optional string[]), integrationTools (optional string[]), inputProcessors (optional Record<string, unknown>[]), outputProcessors (optional Record<string, unknown>[]), memory (optional Record<string, unknown>), scorers (optional Record<string, StorageScorerConfig>)

2. Slim down StorageAgentType to metadata-only fields: id (string), status (string), activeVersionId (optional string), authorId (optional string), metadata (optional Record<string, unknown>), createdAt (Date), updatedAt (Date). Remove ALL config fields (name, description, instructions, model, tools, defaultOptions, workflows, agents, integrationTools, inputProcessors, outputProcessors, memory, scorers).

3. Update StorageCreateAgentInput: it needs to accept BOTH the thin agent record fields AND the initial config. The agent record portion needs id, authorId (optional), metadata (optional). The config portion is a StorageAgentSnapshotType. Structure it so callers provide both -- for example as { id, authorId?, metadata?, snapshot: StorageAgentSnapshotType } or a flat union. Choose whatever is clearest.

4. Update StorageUpdateAgentInput: it should have id (required), optional metadata-level fields (authorId, metadata), and optional config fields (all StorageAgentSnapshotType fields, each optional). The handler layer will separate these into agent-record updates vs new-version creation.

5. In packages/core/src/storage/constants.ts, update AGENTS_SCHEMA to only contain: id (text, not null, primaryKey), status (text, not null), activeVersionId (text, nullable), authorId (text, nullable), metadata (jsonb, nullable), createdAt (timestamp, not null), updatedAt (timestamp, not null). Remove all config columns (name, description, instructions, model, tools, defaultOptions, workflows, agents, integrationTools, inputProcessors, outputProcessors, memory, scorers).

6. In packages/core/src/storage/constants.ts, update AGENT_VERSIONS_SCHEMA: remove the single snapshot jsonb column. Instead, add all config fields as top-level columns: name (text, not null), description (text, nullable), instructions (text, not null), model (jsonb, not null), tools (jsonb, nullable), defaultOptions (jsonb, nullable), workflows (jsonb, nullable), agents (jsonb, nullable), integrationTools (jsonb, nullable), inputProcessors (jsonb, nullable), outputProcessors (jsonb, nullable), memory (jsonb, nullable), scorers (jsonb, nullable). Keep the existing version metadata columns: id, agentId, versionNumber, changedFields, changeMessage, createdAt. Remove the old 'name' column (which was a vanity name for the version) -- the agent config 'name' field replaces it as a top-level column.

7. In packages/core/src/storage/domains/agents/base.ts, update the AgentVersion interface: remove the snapshot field. Instead, the AgentVersion type should extend or include all StorageAgentSnapshotType fields directly (the config IS the version row, not a nested object). Keep the version metadata fields (id, agentId, versionNumber, changedFields, changeMessage, createdAt). The old vanity 'name' field is removed -- the agent config 'name' from StorageAgentSnapshotType replaces it.

8. Update CreateVersionInput in base.ts: remove the snapshot field, include all StorageAgentSnapshotType fields directly.

9. Update the abstract method signatures on AgentsStorage to reflect the new types:
   - createAgent should accept the new StorageCreateAgentInput (with config for version 1)
   - updateAgent should accept the new StorageUpdateAgentInput
   - Return types: createAgent and updateAgent should return StorageAgentType (the thin record)
   - getAgentById returns StorageAgentType (thin record)

10. Update getAgentByIdResolved on the base class: it currently returns StorageAgentType but now needs to return a merged object (agent metadata + version config). Create a new type StorageResolvedAgentType that combines StorageAgentType and StorageAgentSnapshotType fields. Update the method return type and merge logic.

11. Update listAgentsResolved similarly -- it should return StorageResolvedAgentType objects.

12. Update StorageListAgentsOutput to use the appropriate type for the agents array (thin for listAgents, resolved for listAgentsResolved).

13. Make sure all new types are exported from the types.ts file and from any relevant index.ts barrel files so downstream packages can import them.
</tasks>

<testing>
1. Run pnpm build from the repo root -- fix ALL type errors across the monorepo, not just core. These type changes cascade to storage adapters, server, client SDK, and other packages.
2. Run pnpm test:core to verify existing tests still pass (update tests as needed for new types)
3. Verify the new types and updated types are exported by checking build output
4. Confirm AGENTS_SCHEMA only has 7 columns (id, status, activeVersionId, authorId, metadata, createdAt, updatedAt)
5. Confirm AGENT_VERSIONS_SCHEMA has top-level config columns (name, description, instructions, model, tools, etc.) plus version metadata columns (id, agentId, versionNumber, changedFields, changeMessage, createdAt) -- NO snapshot column, NO separate vanity name column
</testing>

Output <promise>COMPLETE</promise> when all tasks are done.
