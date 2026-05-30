# Favorites

Test favorite/unfavorite functionality for stored agents and skills.

Favorite endpoints are documented in `packages/server/src/server/schemas/favorites.ts` (toggle response) and the agent/skill response schemas in the same directory (GET response). Refer to those for exact field names and types; assert against the schema, not against fields baked into this doc.

Both favorite and unfavorite are idempotent — calling them twice returns the same body the second time. Favorites are gated by the `favorites` builder feature (404 if disabled) and require auth (401 under `--auth off`). (This file was formerly named `stars.md`; the feature was renamed `stars` → `favorites` across the stack. See PR #16749 — STACK-3.)

> **Field-name asymmetry.** The toggle endpoint (`PUT|DELETE /stored/{type}/:id/favorite`) returns `{ favorited, favoriteCount }`. The GET endpoint (`/stored/{type}/:id`) exposes the caller's favorite state as `isFavorited` (alongside `favoriteCount`). When asserting "is favorited" on GET, check `isFavorited`, not `favorited`.

## Auth requirement

**This section requires `--auth on`.** Favorites are scoped per caller (the row in `stored_favorites` is keyed on `(entityId, authorId)`). With `--auth off`, there is no caller to attach the favorite to and the route returns either `401 Authentication required` or `404 Not Found` depending on how the route is registered for the current build — both mean "unreachable under auth-off". Treat any non-2xx as the expected outcome.

### Running with `--auth off`

Favorites are **fully unreachable under `--auth off`**. The PUT/DELETE endpoints return a non-2xx (typically `401 Authentication required`, sometimes `404 Not Found` depending on build), and the Studio + Agent Builder favorite buttons render with a "Sign in to favorite this agent/skill" tooltip. Do the sanity check below, mark this section as `Skipped (requires --auth on)`, and move on. Do **not** try to create agents and favorite them — it will not work and is not expected to work.

```bash
# Sanity: confirm favorites are gated by auth
curl -s -o /dev/null -w "%{http_code}\n" -X PUT $BASE/stored/agents/$AGENT_ID/favorite
# → 401 or 404 (unreachable under auth-off)
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/agents/$AGENT_ID/favorite
# → 404
```

- [ ] Both calls return a non-2xx status, either `401` or `404` (both mean "unreachable under auth-off")
- [ ] Skip the rest of this file; report the section as `Skipped (requires --auth on)`

## Prerequisites (auth-on)

You need a logged-in session (`$SESSION` should be a `Cookie:` header) and a stored entity to target.

**If you have `stored-agents:write` / `stored-skills:write`** (owner, admin, member), create test entities:

```bash
# Test agent
AGENT_RESP=$(curl -s -X POST $BASE/stored/agents \
  -H "$SESSION" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Favorite Test Agent",
    "instructions": "Test agent for favorite testing",
    "model": {"provider": "openai", "name": "gpt-4o-mini"}
  }')
AGENT_ID=$(echo "$AGENT_RESP" | jq -r '.id')

# Test skill
SKILL_RESP=$(curl -s -X POST $BASE/stored/skills \
  -H "$SESSION" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Favorite Test Skill",
    "description": "Test skill for favorite testing",
    "instructions": "Favorite test instructions."
  }')
SKILL_ID=$(echo "$SKILL_RESP" | jq -r '.id')
```

**If you don't have write perms** (viewer), use the rows from `seed-multi-user.sh` (run it from SKILL.md execution flow step 4 if you haven't):

```bash
SKILL_ID=smoke-seed-public-skill   # public, owned by user_seed_other
# For agents, skip steps 1–3 and run the skill steps only — the seed script does not
# seed stored agents. Note "agent favorite CRUD: not exercised in non-admin runs" in the report.
```

## Steps

### 1. Favorite an agent

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "favorited": true, "favoriteCount": <n> }` with `n >= 1`

### 2. Verify the agent is favorited

```bash
curl -s $BASE/stored/agents/$AGENT_ID -H "$SESSION" | jq .
```

- [ ] `isFavorited` is `true` on the GET response
- [ ] `favoriteCount` matches the value from step 1

### 3. Unfavorite the agent

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body shows the agent is no longer favorited for the caller and `favoriteCount` decreased by 1
- [ ] Re-fetching the agent reflects the unfavorited state

### 4. Favorite a skill

```bash
curl -s -X PUT $BASE/stored/skills/$SKILL_ID/favorite -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "favorited": true, "favoriteCount": <n> }`

### 5. Verify the skill is favorited

```bash
curl -s $BASE/stored/skills/$SKILL_ID -H "$SESSION" | jq .
```

- [ ] `isFavorited` is `true` on the GET response
- [ ] `favoriteCount` matches step 4

### 6. Unfavorite the skill

```bash
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID/favorite -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "favorited": false, "favoriteCount": <previous - 1> }`

### 7. Idempotent favorite (favorite twice)

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
```

- [ ] Both calls return `200`
- [ ] Both bodies are identical (`favoriteCount` does not increment on the second call)

### 8. Idempotent unfavorite (unfavorite twice)

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/favorite -H "$SESSION" | jq .
```

- [ ] Both calls return `200`
- [ ] Both bodies are identical (`favorited: false`, `favoriteCount` unchanged on the second call)

### Cleanup

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID -H "$SESSION" -o /dev/null -w "%{http_code}\n"  # → 200
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID -H "$SESSION" -o /dev/null -w "%{http_code}\n"  # → 200
```

## Checklist

- [ ] Auth-off path: PUT/DELETE favorite return non-2xx (`401` or `404`); no other assertions
- [ ] Auth-on: favorite agent (200 + `favorited: true`)
- [ ] Verify agent favorited on GET
- [ ] Unfavorite agent (200 + `favorited: false`)
- [ ] Favorite skill (200 + `favorited: true`)
- [ ] Verify skill favorited on GET
- [ ] Unfavorite skill (200 + `favorited: false`)
- [ ] Idempotent favorite (second body identical)
- [ ] Idempotent unfavorite (second body identical)
