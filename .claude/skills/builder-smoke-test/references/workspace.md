# Workspace CRUD

Test stored workspace create, read, update, and delete via API.

## Steps

### 1. List Workspaces

```bash
curl -s http://localhost:4111/api/stored/workspaces | jq .
```

**Verify:**

- [ ] Response is JSON with `workspaces` array
- [ ] Builder workspace appears in the list

### 2. Get Single Workspace

```bash
curl -s http://localhost:4111/api/stored/workspaces/<workspaceId> | jq .
```

**Verify:**

- [ ] Returns the workspace object (not 404)
- [ ] Has `id`, `name`, `status`, `metadata`, `filesystem` fields
- [ ] `metadata.source` is `"builder"` for config-sourced workspaces

### 3. Create a Test Workspace

```bash
curl -s -X POST http://localhost:4111/api/stored/workspaces \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "smoke-test-workspace",
    "name": "Smoke Test Workspace",
    "filesystem": {
      "provider": "local",
      "config": { "basePath": ".mastra/smoke-test-workspace" }
    }
  }' | jq .
```

**Verify:**

- [ ] Returns 200/201 with the created workspace
- [ ] `id` matches `"smoke-test-workspace"`
- [ ] `metadata.source` is NOT `"builder"` (user-created)

### 4. Update the Test Workspace

```bash
curl -s -X PATCH http://localhost:4111/api/stored/workspaces/smoke-test-workspace \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Smoke Test Workspace",
    "description": "Updated during smoke test"
  }' | jq .
```

**Verify:**

- [ ] Returns updated workspace
- [ ] `name` is now `"Updated Smoke Test Workspace"`
- [ ] `updatedAt` changed

### 5. Delete the Test Workspace

```bash
curl -s -X DELETE http://localhost:4111/api/stored/workspaces/smoke-test-workspace | jq .
```

**Verify:**

- [ ] Returns success (200/204)
- [ ] `GET /stored/workspaces/smoke-test-workspace` now returns 404

### 6. Verify Builder Workspace is Untouched

```bash
curl -s http://localhost:4111/api/stored/workspaces/<workspaceId> | jq .
```

- [ ] Builder workspace still exists, unchanged

## Checklist

- [ ] List returns workspaces array
- [ ] Get returns single workspace by ID
- [ ] Create works for user-created workspace
- [ ] Update modifies name/description
- [ ] Delete removes workspace
- [ ] Builder workspace unaffected by test CRUD
