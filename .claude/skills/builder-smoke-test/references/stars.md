# Stars

Test star/unstar functionality for stored agents and skills.

## Prerequisites

Create test entities first (or use entities from the Agents/Skills sections):

```bash
# Create a test agent
AGENT_RESP=$(curl -s -X POST http://localhost:4111/api/stored/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Star Test Agent",
    "instructions": "Test agent for star testing",
    "model": {"provider": "openai", "modelId": "gpt-4o-mini"}
  }')
AGENT_ID=$(echo $AGENT_RESP | jq -r '.id // .agent.id // empty')

# Create a test skill
SKILL_RESP=$(curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Star Test Skill",
    "description": "Test skill for star testing",
    "workspaceId": "<workspaceId>"
  }')
SKILL_ID=$(echo $SKILL_RESP | jq -r '.id // .skill.id // empty')
```

## Steps

### 1. Star an Agent

```bash
curl -s -X PUT http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Returns success (200)

### 2. Verify Agent is Starred

```bash
curl -s http://localhost:4111/api/stored/agents/$AGENT_ID | jq '.starred // .isStarred'
```

- [ ] Agent shows as starred (true or present in starred list)

### 3. Unstar the Agent

```bash
curl -s -X DELETE http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Returns success
- [ ] Agent is no longer starred

### 4. Star a Skill

```bash
curl -s -X PUT http://localhost:4111/api/stored/skills/$SKILL_ID/star | jq .
```

- [ ] Returns success

### 5. Verify Skill is Starred

```bash
curl -s http://localhost:4111/api/stored/skills/$SKILL_ID | jq '.starred // .isStarred'
```

- [ ] Skill shows as starred

### 6. Unstar the Skill

```bash
curl -s -X DELETE http://localhost:4111/api/stored/skills/$SKILL_ID/star | jq .
```

- [ ] Returns success
- [ ] Skill is no longer starred

### 7. Idempotent Star (Star Twice)

```bash
curl -s -X PUT http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
curl -s -X PUT http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Second star call doesn't error (idempotent)
- [ ] Agent still starred (not double-starred)

### 8. Idempotent Unstar (Unstar Twice)

```bash
curl -s -X DELETE http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
curl -s -X DELETE http://localhost:4111/api/stored/agents/$AGENT_ID/star | jq .
```

- [ ] Second unstar call doesn't error

### Cleanup

```bash
curl -s -X DELETE http://localhost:4111/api/stored/agents/$AGENT_ID
curl -s -X DELETE http://localhost:4111/api/stored/skills/$SKILL_ID
```

## Checklist

- [ ] Star agent
- [ ] Verify agent starred state
- [ ] Unstar agent
- [ ] Star skill
- [ ] Verify skill starred state
- [ ] Unstar skill
- [ ] Idempotent star (no error on double-star)
- [ ] Idempotent unstar (no error on double-unstar)
