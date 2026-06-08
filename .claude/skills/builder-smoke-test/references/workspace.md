# Workspace CRUD

Test stored workspace create, read, update, and delete via API.

## Prerequisites

> **Auth-on session header.** Under `--auth on`, prepend `-H "Cookie: $COOKIE"` to every `curl` in this file (exported from `references/auth.md` step 0). Snippets below omit it for readability so they read cleanly under `--auth off`; an authenticated run without the cookie returns `401` before the intended assertion fires.

> **Visibility asymmetry.** Stored workspaces (and the other stored entities) have a `visibility` field that differs between modes. Under `--auth off`, the server coerces `visibility` to `"public"` on every create — there is no caller to scope ownership against, so private wouldn't be meaningful. Under `--auth on`, the field is left as whatever was sent (or `null` when omitted, **not** `"public"`). Don't assert `visibility === "public"` on freshly created workspaces under auth on — assert `null` or whatever you explicitly sent. Visibility behavior is covered in detail by `references/auth.md`.

Resolve the builder workspace ID (used in steps 2 and 6):

```bash
WORKSPACE_ID=$(curl -s ${COOKIE:+-H "Cookie: $COOKIE"} $BASE/stored/workspaces | jq -r '.workspaces[] | select(.metadata.source == "builder") | .id' | head -1)
```

## Steps

### 1. List Workspaces

```bash
curl -s ${COOKIE:+-H "Cookie: $COOKIE"} $BASE/stored/workspaces | jq .
```

**Verify:**

- [ ] Response is JSON with `workspaces` array
- [ ] Builder workspace appears in the list

### 2. Get Single Workspace

```bash
curl -s ${COOKIE:+-H "Cookie: $COOKIE"} $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

**Verify:**

- [ ] Returns the workspace object (not 404)
- [ ] Has `id`, `name`, `status`, `filesystem` fields
- [ ] `metadata.source` is `"builder"` for config-sourced workspaces (`metadata` may be absent on user-created workspaces — `select(.metadata.source == "builder")` jq pattern handles both)

### 3. Create a Test Workspace

```bash
curl -s -X POST $BASE/stored/workspaces \
  -H 'Content-Type: application/json' \
  ${COOKIE:+-H "Cookie: $COOKIE"} \
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
curl -s -X PATCH $BASE/stored/workspaces/smoke-test-workspace \
  -H 'Content-Type: application/json' \
  ${COOKIE:+-H "Cookie: $COOKIE"} \
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
curl -s -X DELETE ${COOKIE:+-H "Cookie: $COOKIE"} $BASE/stored/workspaces/smoke-test-workspace -o /dev/null -w "%{http_code}\n"
```

**Verify:**

- [ ] HTTP `200` or `204` for owner/admin; HTTP `403` for member/viewer (`stored-workspaces:delete` is admin-only — see `references/permissions.md`). On 403, mark "delete blocked by RBAC (expected)" and leave the test workspace in place; subsequent steps should accept its presence.
- [ ] When delete succeeds, `GET /stored/workspaces/smoke-test-workspace` returns `404`

### 6. Verify Builder Workspace is Untouched

```bash
curl -s ${COOKIE:+-H "Cookie: $COOKIE"} $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

- [ ] Builder workspace still exists, unchanged

## Checklist

- [ ] List returns workspaces array
- [ ] Get returns single workspace by ID
- [ ] Create works for user-created workspace
- [ ] Update modifies name/description
- [ ] Delete removes workspace
- [ ] Builder workspace unaffected by test CRUD
