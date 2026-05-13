# Stars

Test star/unstar functionality for stored agents and skills.

Star endpoints are documented in `packages/server/src/server/schemas/stars.ts` (toggle response) and the agent/skill response schemas in the same directory (GET response). Refer to those for exact field names and types; assert against the schema, not against fields baked into this doc.

Both star and unstar are idempotent — calling them twice returns the same body the second time. Stars are gated by the `stars` builder feature (404 if disabled).

> **Field-name asymmetry.** The toggle endpoint (`PUT|DELETE /stored/{type}/:id/star`) returns `{ starred, starCount }`. The GET endpoint (`/stored/{type}/:id`) exposes the caller's star state as `isStarred` (alongside `starCount`). When asserting "is starred" on GET, check `isStarred`, not `starred`.

## Auth requirement

**This section requires `--auth on`.** Stars are scoped per caller (the row in `stored_stars` is keyed on `(entityId, authorId)`). With `--auth off`, there is no caller to attach the star to and the route rejects with `401 Unauthorized`.

### Running with `--auth off`

Stars are **fully unreachable under `--auth off`**. The PUT/DELETE endpoints return `401`, and the Studio + Agent Builder star buttons render as a disabled icon with a "Sign in to star this agent/skill" tooltip (auth-off star-button UX). Do the 401 sanity check below, mark this section as `Skipped (requires --auth on)`, and move on. Do **not** try to create agents and star them — it will not work and is not expected to work.

```bash
# Sanity: confirm stars are gated by auth
curl -s -o /dev/null -w "%{http_code}\n" -X PUT $BASE/stored/agents/$AGENT_ID/star
# → 401
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/agents/$AGENT_ID/star
# → 401
```

- [ ] Both calls return `401`
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
    "name": "Star Test Agent",
    "instructions": "Test agent for star testing",
    "model": {"provider": "openai", "name": "gpt-4o-mini"}
  }')
AGENT_ID=$(echo "$AGENT_RESP" | jq -r '.id')

# Test skill
SKILL_RESP=$(curl -s -X POST $BASE/stored/skills \
  -H "$SESSION" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Star Test Skill",
    "description": "Test skill for star testing",
    "instructions": "Star test instructions."
  }')
SKILL_ID=$(echo "$SKILL_RESP" | jq -r '.id')
```

**If you don't have write perms** (viewer), use the rows from `seed-multi-user.sh` (run it from SKILL.md execution flow step 4 if you haven't):

```bash
SKILL_ID=smoke-seed-public-skill   # public, owned by user_seed_other
# For agents, skip steps 1–3 and run the skill steps only — the seed script does not
# seed stored agents. Note "agent star CRUD: not exercised in non-admin runs" in the report.
```

## Steps

### 1. Star an agent

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": true, "starCount": <n> }` with `n >= 1`

### 2. Verify the agent is starred

```bash
curl -s $BASE/stored/agents/$AGENT_ID -H "$SESSION" | jq .
```

- [ ] `isStarred` is `true` on the GET response
- [ ] `starCount` matches the value from step 1

### 3. Unstar the agent

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body shows the agent is no longer starred for the caller and `starCount` decreased by 1
- [ ] Re-fetching the agent reflects the unstarred state

### 4. Star a skill

```bash
curl -s -X PUT $BASE/stored/skills/$SKILL_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": true, "starCount": <n> }`

### 5. Verify the skill is starred

```bash
curl -s $BASE/stored/skills/$SKILL_ID -H "$SESSION" | jq .
```

- [ ] `isStarred` is `true` on the GET response
- [ ] `starCount` matches step 4

### 6. Unstar the skill

```bash
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": false, "starCount": <previous - 1> }`

### 7. Idempotent star (star twice)

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] Both calls return `200`
- [ ] Both bodies are identical (`starCount` does not increment on the second call)

### 8. Idempotent unstar (unstar twice)

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] Both calls return `200`
- [ ] Both bodies are identical (`starred: false`, `starCount` unchanged on the second call)

### Cleanup

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID -H "$SESSION" -o /dev/null -w "%{http_code}\n"  # → 200
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID -H "$SESSION" -o /dev/null -w "%{http_code}\n"  # → 200
```

## Checklist

- [ ] Auth-off path: PUT/DELETE star return `401` (no other assertions)
- [ ] Auth-on: star agent (200 + `starred: true`)
- [ ] Verify agent starred on GET
- [ ] Unstar agent (200 + `starred: false`)
- [ ] Star skill (200 + `starred: true`)
- [ ] Verify skill starred on GET
- [ ] Unstar skill (200 + `starred: false`)
- [ ] Idempotent star (second body identical)
- [ ] Idempotent unstar (second body identical)
