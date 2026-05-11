# Stars

Test star/unstar functionality for stored agents and skills.

The star endpoints (`PUT|DELETE /stored/{agents,skills}/:id/star`) return `200` with a JSON body of shape `{ starred: boolean, starCount: number }`. Both star and unstar are idempotent — calling them twice returns the same body the second time. The endpoint requires auth; if auth is off it runs as the dev caller. Stars are gated by the `stars` builder feature (404 if disabled).

## Prerequisites

Create test entities first (or use entities from the Agents/Skills sections):

```bash
# Create a test agent
AGENT_RESP=$(curl -s -X POST $BASE/stored/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Star Test Agent",
    "instructions": "Test agent for star testing",
    "model": {"provider": "openai", "modelId": "gpt-4o-mini"}
  }')
AGENT_ID=$(echo $AGENT_RESP | jq -r '.id // .agent.id // empty')

# Create a test skill
SKILL_RESP=$(curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Star Test Skill",
    "description": "Test skill for star testing"
  }')
SKILL_ID=$(echo $SKILL_RESP | jq -r '.id // .skill.id // empty')
```

## Steps

### 1. Star an Agent

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star | jq .
```

- [ ] HTTP `200`
- [ ] Response body: `{ "starred": true, "starCount": <n> }` where `n >= 1`

### 2. Verify Agent is Starred

```bash
curl -s $BASE/stored/agents/$AGENT_ID | jq '{ starred, starCount }'
```

- [ ] `starred` is `true`
- [ ] `starCount` matches the count returned by step 1

### 3. Unstar the Agent

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star | jq .
```

- [ ] HTTP `200`
- [ ] Response: `{ "starred": false, "starCount": <n - 1> }`
- [ ] `GET /stored/agents/$AGENT_ID` now shows `starred: false`

### 4. Star a Skill

```bash
curl -s -X PUT $BASE/stored/skills/$SKILL_ID/star | jq .
```

- [ ] HTTP `200`
- [ ] Response body: `{ "starred": true, "starCount": <n> }`

### 5. Verify Skill is Starred

```bash
curl -s $BASE/stored/skills/$SKILL_ID | jq '{ starred, starCount }'
```

- [ ] `starred` is `true`
- [ ] `starCount` matches step 4

### 6. Unstar the Skill

```bash
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID/star | jq .
```

- [ ] HTTP `200`
- [ ] Response: `{ "starred": false, "starCount": <n - 1> }`

### 7. Idempotent Star (Star Twice)

```bash
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star | jq .
curl -s -X PUT $BASE/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Both calls return HTTP `200`
- [ ] Both response bodies are identical (`starCount` does not increment on the second call)

### 8. Idempotent Unstar (Unstar Twice)

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star | jq .
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Both calls return HTTP `200`
- [ ] Both response bodies are identical (`starred: false`, `starCount` unchanged on the second call)

### Cleanup

```bash
curl -s -X DELETE $BASE/stored/agents/$AGENT_ID
curl -s -X DELETE $BASE/stored/skills/$SKILL_ID
```

## Checklist

- [ ] Star agent (200 + `starred: true`)
- [ ] Verify agent starred state on `GET`
- [ ] Unstar agent (200 + `starred: false`)
- [ ] Star skill (200 + `starred: true`)
- [ ] Verify skill starred state on `GET`
- [ ] Unstar skill (200 + `starred: false`)
- [ ] Idempotent star (second call same body)
- [ ] Idempotent unstar (second call same body)
