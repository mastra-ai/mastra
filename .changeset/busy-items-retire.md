---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/libsql': minor
'@mastra/playground-ui': patch
---

Restructured stored agents to use a thin metadata record with versioned configuration snapshots.

The agent record now only stores metadata fields (id, status, activeVersionId, authorId, metadata, timestamps). All configuration fields (name, instructions, model, tools, etc.) live exclusively in version snapshot rows, enabling full version history and rollback.

**Key changes:**

- Stored Agent records are now thin metadata-only (StorageAgentType)
- All config lives in version snapshots (StorageAgentSnapshotType)
- New resolved type (StorageResolvedAgentType) merges agent record + active version config
- Renamed `ownerId` to `authorId` for multi-tenant filtering
- Changed `memory` field type from `string` to `Record<string, unknown>`
- Added `status` field ('draft' | 'published') to agent records
- Flattened CreateAgent/UpdateAgent input types (config fields at top level, no nested snapshot)
- Version config columns are top-level in the agent_versions table (no single snapshot jsonb column)
- List endpoints return resolved agents (thin record + active version config)
- Auto-versioning on update with retention limits and race condition handling
