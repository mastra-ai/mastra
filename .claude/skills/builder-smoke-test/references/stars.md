# Stars

Test star/unstar functionality for stored agents and skills.

The star endpoints (`PUT|DELETE /stored/{agents,skills}/:id/star`) return `200` with a JSON body of shape `{ starred: boolean, starCount: number }`. Both star and unstar are idempotent — calling them twice returns the same body the second time. Stars are gated by the `stars` builder feature (404 if disabled).

## Auth requirement

**This section requires `--auth on`.** Stars are scoped per caller (the row in `stored_stars` is keyed on `(entityId, authorId)`). With `--auth off`, there is no caller to attach the star to and the route rejects with `401 Unauthorized`.

If you're running with `--auth off`, do this and move on:

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

You need a logged-in session (`$SESSION` should be a `Cookie:` header). Create test entities first:

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

## Steps

### 1. Star an agent

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": true, "starCount": <n> }` with `n >= 1`

### 2. Verify the agent is starred

```bash
curl -s $BASE/stored/agents/$AGENT_ID -H "$SESSION" | jq '{ starred, starCount }'
```

- [ ] `starred == true`
- [ ] `starCount` matches the value from step 1

### 3. Unstar the agent

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": false, "starCount": <previous - 1> }`
- [ ] `GET /stored/agents/$AGENT_ID` now shows `starred: false`

### 4. Star a skill

```bash
curl -s -X PUT $BASE/stored/skills/$SKILL_ID/star -H "$SESSION" | jq .
```

- [ ] HTTP `200`
- [ ] Body is `{ "starred": true, "starCount": <n> }`

### 5. Verify the skill is starred

```bash
curl -s $BASE/stored/skills/$SKILL_ID -H "$SESSION" | jq '{ starred, starCount }'
```

- [ ] `starred == true`
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
