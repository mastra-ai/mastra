# Skill CRUD & Visibility

Test stored skill create, read, update, delete, visibility, and filesystem writes.

## Steps

### 1. Create a Skill

```bash
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Smoke Test Skill",
    "description": "A test skill created during smoke testing",
    "workspaceId": "<workspaceId>",
    "visibility": "private"
  }' | jq .
```

**Verify:**

- [ ] Returns 200/201 with the created skill
- [ ] `name` matches
- [ ] `workspaceId` is set to the builder workspace ID
- [ ] `visibility` is `"private"`
- [ ] `authorId` is set (should be a user ID from the session, or a default if no auth)
- [ ] `id` is generated (record it for subsequent steps)

Record the skill ID: `SKILL_ID=<returned id>`

### 2. Get the Skill

```bash
curl -s http://localhost:4111/api/stored/skills/$SKILL_ID | jq .
```

- [ ] Returns the skill with all fields matching
- [ ] `workspaceId` present
- [ ] `createdAt` and `updatedAt` present

### 3. List Skills

```bash
curl -s http://localhost:4111/api/stored/skills | jq .
```

- [ ] Response has `skills` array
- [ ] The created skill appears in the list
- [ ] Each skill has `name`, `description`, `visibility`, `workspaceId`

### 4. Update Visibility (Private → Public)

```bash
curl -s -X PATCH http://localhost:4111/api/stored/skills/$SKILL_ID \
  -H 'Content-Type: application/json' \
  -d '{"visibility": "public"}' | jq .
```

- [ ] Returns updated skill
- [ ] `visibility` is now `"public"`
- [ ] `updatedAt` changed

### 5. Update Skill Metadata

```bash
curl -s -X PATCH http://localhost:4111/api/stored/skills/$SKILL_ID \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Smoke Skill",
    "description": "Updated description for smoke testing"
  }' | jq .
```

- [ ] `name` updated
- [ ] `description` updated
- [ ] `visibility` still `"public"` (not reset)

### 6. Create a Second Skill (Public)

```bash
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Public Smoke Skill",
    "description": "A public skill for smoke testing",
    "workspaceId": "<workspaceId>",
    "visibility": "public"
  }' | jq .
```

Record the second skill ID: `SKILL_ID_2=<returned id>`

- [ ] Created successfully with `visibility: "public"`

### 7. List Skills — Verify Both

```bash
curl -s http://localhost:4111/api/stored/skills | jq '.skills | length'
```

- [ ] Count includes both new skills

### 8. Publish Skill (if endpoint exists)

```bash
curl -s -X POST http://localhost:4111/api/stored/skills/$SKILL_ID/publish \
  -H 'Content-Type: application/json' | jq .
```

- [ ] Returns success or valid error (endpoint may not be fully implemented yet)
- [ ] Note the response for future reference

### 9. Delete Skills (Cleanup)

```bash
curl -s -X DELETE http://localhost:4111/api/stored/skills/$SKILL_ID | jq .
curl -s -X DELETE http://localhost:4111/api/stored/skills/$SKILL_ID_2 | jq .
```

- [ ] Both return success
- [ ] `GET /stored/skills/$SKILL_ID` returns 404
- [ ] Skills list count decreased

## Filesystem persistence (#16000)

When a skill is created or installed, files persist under the workspace filesystem at `.mastra/workspace/skills/<skill-name>/SKILL.md` (plus any `references/`, `scripts/`, `assets/` subdirs from the source).

### F1. Inspect the persisted file

After step 1 above (or after an install from the registry):

```bash
SKILL_NAME=$(curl -s "$BASE/stored/skills/$SKILL_ID" | jq -r '.name' | tr '[:upper:] ' '[:lower:]-')
ls -la "examples/agent/.mastra/workspace/skills/$SKILL_NAME/"
cat "examples/agent/.mastra/workspace/skills/$SKILL_NAME/SKILL.md"
```

- [ ] `SKILL.md` exists
- [ ] Frontmatter block at top includes `name`, `description`
- [ ] Body matches the stored `instructions`

### F2. Files array on response

```bash
curl -s "$BASE/stored/skills/$SKILL_ID" | jq '.files'
```

- [ ] `files` is an array (or tree) of `{ path, ... }` entries
- [ ] At minimum, `SKILL.md` is present
- [ ] No raw `instructions` in the array's `SKILL.md` (the tree shape should reflect persisted content)

### F3. Auto-publish on visibility flip

Set visibility to `public` (step 4 above). After the flip:

- [ ] `POST /stored/skills/:id/publish` is auto-invoked (or visible side-effect)
- [ ] The skill's `publishedAt` (if exposed) is set
- [ ] No 5xx errors

## Frontmatter handling (skills.sh + library copies)

If this skill was installed from skills.sh or copied from the library:

- [ ] `instructions` does NOT begin with `---` (frontmatter stripped at install/copy)
- [ ] `metadata.origin.type` is `skills-sh` or `library-copy` (see `references/registry.md`)

## Edge Cases (Optional)

### Duplicate Skill Name

```bash
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{"name": "Dupe Skill", "workspaceId": "<workspaceId>"}' | jq .

curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{"name": "Dupe Skill", "workspaceId": "<workspaceId>"}' | jq .
```

- [ ] Second create either succeeds (unique IDs) or returns a meaningful error
- [ ] No server crash

### Skill Without Workspace

```bash
curl -s -X POST http://localhost:4111/api/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{"name": "No Workspace Skill"}' | jq .
```

- [ ] Returns error or creates with null workspace
- [ ] No server crash

## Checklist

- [ ] Create skill with workspace and visibility
- [ ] Get skill by ID
- [ ] List skills returns all skills
- [ ] Update visibility (private → public)
- [ ] Update metadata (name, description)
- [ ] Delete skill
- [ ] (Optional) Duplicate name handling
- [ ] (Optional) Skill without workspace
