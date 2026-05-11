# Workspace Reconciliation

Test the config-driven workspace lifecycle managed by `ensureBuilderWorkspaces()`.

These tests require server restarts and config changes, so they're more involved than pure API tests. Some scenarios are already covered by unit tests in `packages/editor/src/editor-workspace-reconciliation.test.ts` — this section verifies the behavior end-to-end.

## Background

On startup, `ensureBuilderWorkspaces()`:

1. Reads the builder config's `workspace` field
2. Resolves the referenced `Workspace` instance from the Mastra constructor
3. Snapshots the workspace config (name, filesystem, sandbox)
4. Creates or updates the stored workspace in the DB
5. Archives orphaned workspaces (ones tagged `metadata.source: "builder"` that are no longer in the config)

## Prerequisites

Resolve the builder workspace ID (the rest of this file assumes `$WORKSPACE_ID` is set):

```bash
WORKSPACE_ID=$(curl -s $BASE/stored/workspaces | jq -r '.workspaces[] | select(.metadata.source == "builder") | .id' | head -1)
echo "WORKSPACE_ID=$WORKSPACE_ID"
```

## Steps

### 1. Fresh Startup Persistence

This is verified in **Setup** (section 1). After a fresh server start:

```bash
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

- [ ] Workspace exists with `metadata.source: "builder"`
- [ ] `runtimeRegistered` is `true`
- [ ] Filesystem and sandbox config match what's in `examples/agent/src/mastra/index.ts`

### 2. Idempotent Restart (No-Op)

Restart the server without changing any config. Record the workspace's `updatedAt` and `resolvedVersionId` before and after.

```bash
# Before restart
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq '{updatedAt, resolvedVersionId}'

# Restart server (Ctrl+C, pnpm mastra:dev)
# After restart
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq '{updatedAt, resolvedVersionId}'
```

- [ ] `updatedAt` is unchanged (no write on no-op)
- [ ] `resolvedVersionId` is unchanged
- [ ] No duplicate workspace records

### 3. Config Drift Detection

Change the workspace config in `examples/agent/src/mastra/index.ts`. For example, change the `basePath`:

```typescript
// Before
filesystem: new LocalFilesystem({ basePath: '.mastra/workspace' }),

// After (temporary change for testing)
filesystem: new LocalFilesystem({ basePath: '.mastra/workspace-v2' }),
```

Restart the server, then check:

```bash
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

- [ ] `filesystem.config.basePath` is now `.mastra/workspace-v2`
- [ ] `updatedAt` changed (DB was updated)
- [ ] `resolvedVersionId` changed (new version created)
- [ ] `id` and `createdAt` unchanged (same workspace, just updated)
- [ ] Still only 1 workspace with this ID

**⚠️ Revert the config change after verifying:**

```typescript
filesystem: new LocalFilesystem({ basePath: '.mastra/workspace' }),
```

### 4. Orphan Archival

Change the workspace ID in the builder config:

```typescript
// In the Workspace constructor
id: 'builder-workspace-v2',

// In the MastraEditor config
workspace: { type: 'id', workspaceId: 'builder-workspace-v2' },
```

Restart the server, then check both workspaces:

```bash
# Old workspace should be archived
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq '{status, metadata}'

# New workspace should be created
curl -s $BASE/stored/workspaces/builder-workspace-v2 | jq '{status, metadata}'
```

- [ ] Old workspace: `status` is `"archived"`
- [ ] Old workspace: `metadata.source` still `"builder"`
- [ ] New workspace: `status` is `"draft"`, `metadata.source` is `"builder"`
- [ ] Old workspace NOT deleted (preserved for data safety)

**⚠️ Revert the config change after verifying.** On next restart, the old workspace should un-archive and the v2 workspace should be archived.

### 5. Non-Builder Workspaces Untouched

Create a user workspace, then restart the server:

```bash
# Create user workspace
curl -s -X POST $BASE/stored/workspaces \
  -H 'Content-Type: application/json' \
  -d '{"id": "user-workspace", "name": "User Workspace"}' | jq .

# Record state
curl -s $BASE/stored/workspaces/user-workspace | jq '{status, metadata, updatedAt}'

# Restart server, then check again
curl -s $BASE/stored/workspaces/user-workspace | jq '{status, metadata, updatedAt}'
```

- [ ] User workspace is unchanged after restart
- [ ] `metadata.source` is NOT `"builder"` (or absent)
- [ ] `status` unchanged (not archived by reconciliation)

Clean up:

```bash
curl -s -X DELETE $BASE/stored/workspaces/user-workspace
```

### 6. Metadata Backfill

This scenario covers old workspace records that were created before `metadata.source` was added. It's difficult to test manually without direct DB access. **Covered by unit tests** in `editor-workspace-reconciliation.test.ts`.

- [ ] Verified by unit test: `it('backfills metadata.source on existing workspace without metadata')`

## Checklist

- [ ] Fresh startup creates workspace with builder metadata
- [ ] Idempotent restart doesn't modify workspace
- [ ] Config drift updates workspace in DB
- [ ] Orphan archival archives removed workspaces
- [ ] Non-builder workspaces untouched
- [ ] Metadata backfill covered by unit tests
