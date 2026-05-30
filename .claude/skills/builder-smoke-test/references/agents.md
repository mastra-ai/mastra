# Stored Agent CRUD & Skill Attachment

Test stored agent create, read, update, delete, skill attachment, and model configuration.

The model values used below (`openai/gpt-4o-mini`, `openai/gpt-4o`) are valid under the scaffolded project's admin policy, which allows any `openai` model via wildcard plus exactly `anthropic/claude-opus-4-7` (see the scaffolded project's `src/mastra/index.ts` → `models.allowed`). If you've changed the policy, swap these for something allowed.

> **Server schema reminder:** `model` is `{ provider, name }` — **not** `{ provider, modelId }`. The schema lives in `packages/server/src/server/schemas/stored-agents.ts`. Posting `modelId` returns `400 model: Invalid input`.

> **Pagination is 0-indexed.** `page=0` is the first page; `page=1` is the second. Default `perPage` varies by endpoint; pass it explicitly if it matters.

> **Visibility is auth-on-only.** With `--auth off`, the server has no caller to attribute ownership to, so it forces `visibility: "public"` regardless of what you send. Don't assert on visibility under auth off; verify it under `--auth on` in `references/auth.md`.

> Schemas are in `packages/server/src/server/schemas/stored-agents.ts`. Treat that file as the source of truth for response shapes.

> **Capability gate.** Create / PATCH / DELETE steps require `stored-agents:write`. The scaffold grants this to owner, admin, and member; viewer does not have it. Under `--role viewer`, mark write steps `n/a — role lacks stored-agents:write` and run only the read-side steps (GET list, GET by id).

> **Auth-on session header.** Under `--auth on`, prepend `-H "Cookie: $COOKIE"` to every `curl` in this file (exported from `references/auth.md` step 0). Snippets below omit it for readability so they read cleanly under `--auth off`; an authenticated run without the cookie returns `401` before the intended assertion fires.

## Steps

### 1. Create a stored agent

```bash
curl -s -X POST $BASE/stored/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Smoke Test Agent",
    "instructions": "You are a helpful test agent created during smoke testing.",
    "model": {
      "provider": "openai",
      "name": "gpt-4o-mini"
    }
  }' | jq .
```

**Verify:**

- [ ] Returns 200 with the created agent
- [ ] `name` matches the request
- [ ] Response includes a workspace association referencing the builder workspace
- [ ] `id` is present; record it as `AGENT_ID=<id>`

Notes (don't assert under `--auth off`):

- `visibility` will be `"public"` regardless of request (see auth-on path).
- `authorId` will be `null` (no caller).
- `favoriteCount` will be `0` and `isFavorited` will be `false` (no caller-scoped favorite rows).

### 2. Get the agent

```bash
curl -s $BASE/stored/agents/$AGENT_ID | jq .
```

- [ ] Returns 200 with the agent
- [ ] `model.provider == "openai"` and `model.name == "gpt-4o-mini"`
- [ ] `instructions` matches
- [ ] `createdAt` and `updatedAt` are ISO timestamps

### 3. List agents

```bash
# Page 0 is the first page
curl -s "$BASE/stored/agents?page=0&perPage=50" | jq '{ total, page, perPage, count: (.agents | length) }'
```

- [ ] `total >= 1`
- [ ] `agents` array length matches `total` (assuming `total <= perPage`)
- [ ] The created `$AGENT_ID` appears in the array

### 4. Create a skill for attachment

```bash
SKILL_RESP=$(curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Agent Smoke Skill",
    "description": "Skill to attach to smoke test agent",
    "instructions": "Skill-level instructions for the smoke test."
  }')
echo "$SKILL_RESP" | jq .
SKILL_ID=$(echo "$SKILL_RESP" | jq -r '.id')
echo "SKILL_ID=$SKILL_ID"
```

- [ ] Response is 200 with an `id`

> `instructions` is required by the schema today. Creating a skill without it returns 400.

### 5. Attach skill to agent

```bash
curl -s -X PATCH $BASE/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d "{\"skills\": {\"$SKILL_ID\": {}}}" | jq '.skills'
```

- [ ] PATCH returns 200
- [ ] `skills` object contains a key `$SKILL_ID`

### 6. Verify skill cross-reference

```bash
curl -s $BASE/stored/agents/$AGENT_ID | jq '.skills'
```

- [ ] Skills object includes `$SKILL_ID`

### 7. Update agent model

```bash
curl -s -X PATCH $BASE/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{
    "model": {
      "provider": "openai",
      "name": "gpt-4o"
    }
  }' | jq '.model'
```

- [ ] `model.name == "gpt-4o"`
- [ ] `model.provider == "openai"`

### 8. Update agent instructions

```bash
curl -s -X PATCH $BASE/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{"instructions": "Updated instructions for smoke testing."}' | jq '.instructions'
```

- [ ] Returns the new instructions string verbatim

### 9. Detach skill from agent

```bash
curl -s -X PATCH $BASE/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{"skills": {}}' | jq '.skills'
```

- [ ] `skills` is now an empty object

### 10. Delete agent and skill (cleanup)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/agents/$AGENT_ID  # → 200
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/skills/$SKILL_ID  # → 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/stored/agents/$AGENT_ID            # → 404
curl -s -o /dev/null -w "%{http_code}\n" $BASE/stored/skills/$SKILL_ID            # → 404
```

## Delete from view / edit (#16199)

From the agents list, clicking a row navigates to `/agent-builder/agents/$AGENT_ID/view`. Owners can switch to `/edit` from there.

- [ ] `Delete agent` affordance is reachable from the view or edit page (kebab menu, panel button, or similar). Log which surface exposes it.
- [ ] Clicking opens a confirm dialog
- [ ] Confirming deletes the agent and navigates back to the agents list
- [ ] Subsequent `GET /stored/agents/$AGENT_ID` returns 404

## Avatar upload (owner-only, #15877 / #16264)

Owners may upload an avatar; non-owners (even admins) cannot. This step requires `--auth on`.

There is **no dedicated `/avatar` endpoint**. Avatars ride on the regular agent PATCH as `metadata.avatarUrl` (a data URL). The server validates size and shape via `validateMetadataAvatarUrl` in `packages/server/src/server/handlers/validate-avatar.ts` (current cap is 512 KB; accepted MIME types are `image/png`, `image/jpeg`, `image/webp`, `image/gif`).

```bash
# Construct a small PNG data URL (any tiny image works; example is 1x1 transparent)
SAMPLE_PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="

curl -s -X PATCH "$BASE/stored/agents/$AGENT_ID" \
  -H "Content-Type: application/json" \
  -H "$SESSION" \
  -d "{\"metadata\": {\"avatarUrl\": \"$SAMPLE_PNG\"}}" | jq '.metadata.avatarUrl'
```

- [ ] Owner: 200, response `metadata.avatarUrl` is the data URL you sent (or a server-rewritten URL)
- [ ] Non-owner authenticated user: 403 (ownership check inside `assertWriteAccess`)
- [ ] Auth off: behaves as owner (no caller → bypass)
- [ ] Oversized blob (>512 KB) is rejected with **`413 Payload Too Large`** from `validateMetadataAvatarUrl` (not `400`)

## Builder defaults at create

For full coverage of `applyBuilderDefaults()`, see `references/defaults.md`. Short version: when you POST `/stored/agents` with no `workspace`/`memory`/`browser`/`model`, the response should include the configured defaults.

## Model dropdown verification

The builder config defines which models are allowed. Verify via the settings endpoint:

```bash
curl -s $BASE/editor/builder/settings | jq '{ models: .configuration.agent.models, modelPolicy }'
```

- [ ] `configuration.agent.models.allowed` and `modelPolicy.allowed` agree on the same allow-list
- [ ] Both include the entry you used in step 1 (`{ "provider": "openai" }` wildcard covers `gpt-4o-mini`)

## Checklist

- [ ] Create stored agent (`model.name`, not `modelId`) with auto-workspace assignment
- [ ] Get agent by ID returns 200 with matching fields
- [ ] List agents with `page=0` includes the new agent
- [ ] Create + attach skill (skill `instructions` required)
- [ ] Skill cross-reference visible on GET
- [ ] Update model (provider + name)
- [ ] Update instructions
- [ ] Detach skill
- [ ] Delete agent + skill, follow-up GET returns 404
- [ ] Model policy in settings matches what was accepted on create
