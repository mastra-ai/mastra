# Stored Agent CRUD & Skill Attachment

Test stored agent create, read, update, delete, skill attachment, and model configuration.

## Steps

### 1. Create a Stored Agent

```bash
curl -s -X POST http://localhost:4111/api/stored/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Smoke Test Agent",
    "instructions": "You are a helpful test agent created during smoke testing.",
    "model": {
      "provider": "openai",
      "modelId": "gpt-4o-mini"
    },
    "visibility": "private"
  }' | jq .
```

**Verify:**

- [ ] Returns 200/201 with the created agent
- [ ] `name` matches
- [ ] `workspaceId` is auto-assigned to the builder workspace (from config)
- [ ] `visibility` is `"private"`
- [ ] `authorId` is set
- [ ] `status` is `"draft"`
- [ ] `id` is generated (record it)

Record the agent ID: `AGENT_ID=<returned id>`

### 2. Get the Agent

```bash
curl -s http://localhost:4111/api/stored/agents/$AGENT_ID | jq .
```

- [ ] Returns agent with all fields
- [ ] `model.provider` and `model.modelId` present
- [ ] `instructions` present
- [ ] `createdAt` and `updatedAt` present

### 3. List Agents

```bash
curl -s http://localhost:4111/api/stored/agents | jq .
```

- [ ] Response has `agents` array
- [ ] The created agent appears in the list
- [ ] Each agent has `name`, `visibility`, `status`, `workspaceId`

### 4. Create a Skill for Attachment

Create a skill to attach to the agent:

```bash
SKILL_RESP=$(curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Agent Smoke Skill",
    "description": "Skill to attach to smoke test agent",
    "workspaceId": "<workspaceId>"
  }')
echo $SKILL_RESP | jq .
SKILL_ID=$(echo $SKILL_RESP | jq -r '.id // .skill.id // empty')
```

### 5. Attach Skill to Agent

```bash
curl -s -X PATCH http://localhost:4111/api/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d "{\"skills\": [\"$SKILL_ID\"]}" | jq .
```

- [ ] Returns updated agent
- [ ] `skills` array contains the skill ID

### 6. Verify Skill Cross-Reference

```bash
curl -s http://localhost:4111/api/stored/agents/$AGENT_ID | jq '.skills'
```

- [ ] Skills array includes the attached skill ID

### 7. Update Agent Visibility

```bash
curl -s -X PATCH http://localhost:4111/api/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{"visibility": "public"}' | jq .
```

- [ ] `visibility` is now `"public"`
- [ ] `updatedAt` changed

### 8. Update Agent Model

```bash
curl -s -X PATCH http://localhost:4111/api/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{
    "model": {
      "provider": "openai",
      "modelId": "gpt-4o"
    }
  }' | jq .
```

- [ ] `model.modelId` is now `"gpt-4o"`
- [ ] Other fields unchanged

### 9. Update Agent Instructions

```bash
curl -s -X PATCH http://localhost:4111/api/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{"instructions": "Updated instructions for smoke testing."}' | jq .
```

- [ ] `instructions` updated
- [ ] Other fields preserved

### 10. Detach Skill from Agent

```bash
curl -s -X PATCH http://localhost:4111/api/stored/agents/$AGENT_ID \
  -H 'Content-Type: application/json' \
  -d '{"skills": []}' | jq .
```

- [ ] `skills` array is now empty

### 11. Delete Agent and Skill (Cleanup)

```bash
curl -s -X DELETE http://localhost:4111/api/stored/agents/$AGENT_ID | jq .
curl -s -X DELETE http://localhost:4111/api/stored/skills/$SKILL_ID | jq .
```

- [ ] Both return success
- [ ] `GET` on either returns 404

## Delete from edit / view (#16199)

Open the agent in the Builder edit page (`/agent-builder/agents/$AGENT_ID`):

- [ ] "Delete agent" affordance is reachable from the edit/view header (kebab menu or similar)
- [ ] Clicking opens a confirm dialog
- [ ] Confirming deletes the agent and navigates back to the agents list
- [ ] Subsequent `GET /stored/agents/$AGENT_ID` returns 404

## Avatar upload (owner-only, #15877 / #16264)

Owners may upload an avatar; non-owners (even admins) cannot.

```bash
curl -s -X POST "$BASE/stored/agents/$AGENT_ID/avatar" \
  -H "$SESSION" \
  -F 'file=@/path/to/sample.png' | jq .
```

- [ ] Owner: 200 with the persisted avatar URL/blob ID
- [ ] Non-owner authenticated user: 403
- [ ] Auth off: behaves as owner (bypass)

## Builder defaults at create

For full coverage of `applyBuilderDefaults()`, see `references/defaults.md`. Short version: when you POST `/stored/agents` with no `workspace`/`memory`/`browser`/`model`, the response should include the configured defaults.

## Model Dropdown Verification

The builder config defines which models are allowed. Verify via the settings endpoint:

```bash
curl -s http://localhost:4111/api/editor/builder/settings | jq '.models // .modelPolicy'
```

- [ ] Lists allowed providers/models
- [ ] Creating an agent with a disallowed model should fail or be restricted (depends on implementation)

## Checklist

- [ ] Create stored agent with auto-workspace assignment
- [ ] Get agent by ID
- [ ] List agents
- [ ] Create and attach skill to agent
- [ ] Verify skill cross-reference
- [ ] Update visibility (private → public)
- [ ] Update model
- [ ] Update instructions
- [ ] Detach skill
- [ ] Delete agent and skill
- [ ] Model policy verified via settings
