<background>
You are a senior TypeScript developer working on Mastra framework storage adapters for the stored agents feature. Command 1 has already updated the core types and schema in packages/core/src/storage/.

The agent record is now metadata-only (id, status, activeVersionId, authorId, metadata, timestamps). ALL config (name, description, instructions, model, tools, etc.) lives in version rows as top-level columns (NOT a nested config jsonb column). The version row IS the snapshot -- config fields sit alongside version metadata fields (id, agentId, versionNumber, changedFields, changeMessage, createdAt).

Key behaviors to implement:
- createAgent: Creates agent record with status='draft' and activeVersionId=null, PLUS creates version 1 with the initial config. Returns the thin agent record.
- updateAgent: Metadata fields (authorId, metadata) update the agent record directly. Config fields (any StorageAgentSnapshotType field) create a new version row. Does NOT update activeVersionId or status. Returns the thin agent record.
- getAgentByIdResolved: Returns agent metadata merged with the active version config. If no active version (activeVersionId is null), falls back to latest version.
- listAgentsResolved: Same merge behavior for list results.
- InMemory adapter: Keep metadata MERGE semantics (existing.metadata spread with updates.metadata). This adapter is primarily used for testing.
- DB adapters (PG, MongoDB, LibSQL): metadata is REPLACED on update (standard DB behavior).
- deleteAgent: Still cascades to delete all versions.

Read STORED_AGENTS_FEATURE.md in the repo root for full feature context.
</background>

<setup>
1. Read STORED_AGENTS_FEATURE.md for full feature context
2. Read packages/core/src/storage/types.ts for the updated types (StorageAgentType is now thin, StorageAgentSnapshotType is new, StorageResolvedAgentType merges both)
3. Read packages/core/src/storage/constants.ts for updated AGENTS_SCHEMA
4. Read packages/core/src/storage/domains/agents/base.ts for updated abstract class and method signatures
5. Read packages/core/src/storage/domains/agents/inmemory.ts -- full file, understand current deep copy patterns, update logic, and version management
6. Read stores/pg/src/storage/domains/agents/index.ts -- full file, understand SQL patterns and JSON parsing
7. Read stores/mongodb/src/storage/domains/agents/index.ts -- full file
8. Read stores/libsql/src/storage/domains/agents/index.ts -- full file
</setup>

<tasks>
1. Update InMemoryAgentsStorage.createAgent: Create the thin agent record in the agents Map (id, status='draft', activeVersionId=null, authorId, metadata, timestamps). Then create version 1 in the versions Map using the config from the input. Return the thin agent record.

2. Update InMemoryAgentsStorage.updateAgent: Separate the update into metadata fields and config fields. For metadata fields (authorId, metadata), update the agent record directly. Keep the existing metadata merge behavior ({ ...existing.metadata, ...updates.metadata }). For config fields, if any config field is present in the update: fetch the latest version config, merge the changes into it, and create a new version row. Do NOT update activeVersionId or status. Return the thin agent record.

3. Update InMemoryAgentsStorage.getAgentById: Return only the thin agent record (this should mostly work already since the agent Map now stores thin records).

4. Update InMemoryAgentsStorage.deleteAgent: Continue cascading deletes to all versions for the agent.

5. Update the deep copy helper (deepCopyAgent or equivalent): It should only deep copy the thin agent record fields now. Create a separate deepCopySnapshot helper for version configs if needed.

6. Update the base class getAgentByIdResolved method: Fetch the thin agent record. If activeVersionId is set, fetch that version and merge its config with the agent metadata. If activeVersionId is null, fetch the latest version (getLatestVersion) and merge that. Return a StorageResolvedAgentType. Preserve id, status, activeVersionId, authorId, metadata, createdAt, updatedAt from the agent record and all config fields from the version row.

7. Update listAgentsResolved on the base class: For each agent in the list, resolve it the same way as getAgentByIdResolved (active version or latest version). Return StorageResolvedAgentType objects.

8. Update PostgreSQL adapter (stores/pg/src/storage/domains/agents/index.ts): Implement the same createAgent (insert agent row + version row), updateAgent (separate metadata vs config, config creates version), getAgentById (query thin table), deleteAgent (cascade). Update SQL queries to match the new slimmed-down agents table columns. For listAgentsResolved, consider using a JOIN with the versions table to get name/description efficiently rather than N+1 queries.

9. Update MongoDB adapter (stores/mongodb/src/storage/domains/agents/index.ts): Same logic as PG but using MongoDB operations. Update indexes if needed (the agents collection no longer has name/description fields to index on).

10. Update LibSQL adapter (stores/libsql/src/storage/domains/agents/index.ts): Same logic as PG using LibSQL query patterns.

11. For each adapter, make sure createVersion still works correctly -- the config parameter is now StorageAgentSnapshotType instead of the full StorageAgentType.

12. Add or update tests for the InMemory adapter that verify:
    - Creating an agent produces a thin record with status='draft' and activeVersionId=null, plus version 1 in the versions store
    - Updating with config fields creates a new version without changing activeVersionId or status
    - Updating with only metadata fields does not create a new version
    - getAgentByIdResolved returns merged data from the latest version when no active version is set
    - deleteAgent cascades to versions
</tasks>

<testing>
1. Run pnpm build:core to verify InMemory adapter compiles
2. Build each store adapter and fix type errors (the build commands may vary -- check each store package.json)
3. Run existing stored agents tests and fix any failures
4. Verify the new tests from task 12 pass
</testing>

Output <promise>COMPLETE</promise> when all tasks are done.
