# Skill CRUD & Visibility

Test stored skill create, read, update, delete, visibility, and filesystem writes.

> **Visibility is auth-on-only.** With `--auth off`, the server forces `visibility: "public"` and `authorId: null` on every create / PATCH, regardless of what you send. The `visibility`-toggle and visibility assertions below live in `references/auth.md`. Under `--auth off`, treat any `visibility` field on responses as fixed at `"public"` and don't assert on it.

> **Pagination is 0-indexed.** `page=0` is the first page.

> **Known broken: partial PATCH (#TBD).** `PATCH /stored/skills/:id` with only `{ name }`, `{ description }`, or `{ instructions }` currently returns `500`. The handler passes `undefined` for unset fields through to the storage layer, which triggers a `NOT NULL` violation on `mastra_skill_versions.instructions` when the patch creates a new version row. Treat the PATCH steps below as expected-fail (assert `500`) until that bug is fixed.

## Steps

### 1. Create a skill

```bash
curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Smoke Test Skill",
    "description": "A test skill created during smoke testing",
    "instructions": "Skill instructions for the smoke test."
  }' | jq .
```

**Verify:**

- [ ] Returns 200 with the created skill
- [ ] `name` and `description` match
- [ ] `workspaceId` is auto-assigned to the builder workspace
- [ ] `id` is a UUID; record it as `SKILL_ID=<id>`

> `instructions` is required by the schema. Omitting it returns 400.

### 2. Get the skill

```bash
curl -s $BASE/stored/skills/$SKILL_ID | jq .
```

- [ ] Returns 200 with the skill
- [ ] `workspaceId` present
- [ ] `createdAt` and `updatedAt` are ISO timestamps

### 3. List skills

```bash
curl -s "$BASE/stored/skills?page=0&perPage=50" | jq '{ total, page, perPage, count: (.skills | length) }'
```

- [ ] `total >= 1`
- [ ] The created `$SKILL_ID` appears in `skills`

### 4. Update skill metadata (known-broken under partial PATCH)

```bash
curl -s -o /tmp/skill-patch.json -w "%{http_code}\n" -X PATCH $BASE/stored/skills/$SKILL_ID \
  -H 'Content-Type: application/json' \
  -d '{"name": "Updated Smoke Skill"}'
cat /tmp/skill-patch.json | jq .
```

Expected today:
- [ ] HTTP `500`
- [ ] Body mentions a `NOT NULL` constraint violation on `instructions` (or a similar storage error)
- [ ] Log this as a known regression in the run report and move on

Once the bug is fixed, this should return `200` with the updated `name` and an unchanged `description` / `instructions`. A full-body PATCH (sending `name` + `description` + `instructions` together) is the current workaround and should still return 200.

### 5. Create a second skill

```bash
curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Second Smoke Skill",
    "description": "Another skill for smoke testing",
    "instructions": "Second skill instructions."
  }' | jq '.id'
```

Record the second ID: `SKILL_ID_2=<returned id>`

- [ ] Returns 200 with a UUID

### 6. List skills — verify both

```bash
curl -s "$BASE/stored/skills?page=0&perPage=50" | jq '[.skills[].id] | map(select(. == $a or . == $b)) | length' \
  --arg a "$SKILL_ID" --arg b "$SKILL_ID_2"
```

- [ ] Returns `2`

### 7. Publish skill

The publish endpoint requires a `skillPath` pointing at a directory on the server filesystem that contains a `SKILL.md`. The schema lives at `packages/server/src/server/schemas/stored-skills.ts` → `publishStoredSkillBodySchema`. The server validates the path is under the allowed base (path-traversal guard).

```bash
# Derive the on-disk path for this skill (slugified name under the builder workspace)
SKILL_NAME_SLUG=$(curl -s "$BASE/stored/skills/$SKILL_ID" | jq -r '.name' | tr '[:upper:] ' '[:lower:]-')
SKILL_PATH="$(pwd)/examples/agent/.mastra/workspace/skills/$SKILL_NAME_SLUG"

curl -s -X POST $BASE/stored/skills/$SKILL_ID/publish \
  -H 'Content-Type: application/json' \
  -d "{\"skillPath\": \"$SKILL_PATH\"}" | jq .
```

- [ ] HTTP `200` with the persisted skill record
- [ ] Response includes a fresh `activeVersionId` (or `versionId`)
- [ ] `GET /stored/skills/$SKILL_ID` reflects the new active version
- [ ] If the directory doesn't exist yet (no filesystem persistence configured for this skill), the call returns `404` with `Skill "..." not found at <path>` — that's expected, log it and move on
- [ ] Posting without `skillPath` returns `400` (`skillPath: Required`)

### 8. Delete skills (cleanup)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/skills/$SKILL_ID    # → 200
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/skills/$SKILL_ID_2  # → 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/stored/skills/$SKILL_ID              # → 404
```

## Filesystem persistence (#16000)

When a skill is created or installed, files persist under the workspace filesystem at `.mastra/workspace/skills/<skill-name>/SKILL.md` (plus any `references/`, `scripts/`, `assets/` subdirs from the source).

### F1. Inspect the persisted file

After step 1 (or after an install from the registry):

```bash
SKILL_NAME=$(curl -s "$BASE/stored/skills/$SKILL_ID" | jq -r '.name' | tr '[:upper:] ' '[:lower:]-')
ls -la "examples/agent/.mastra/workspace/skills/$SKILL_NAME/"
cat "examples/agent/.mastra/workspace/skills/$SKILL_NAME/SKILL.md"
```

- [ ] `SKILL.md` exists at that path
- [ ] Frontmatter block at the top includes `name`, `description`
- [ ] Body matches the stored `instructions`

### F2. Files array on response

```bash
curl -s "$BASE/stored/skills/$SKILL_ID" | jq '.files'
```

- [ ] `files` is an array of `{ path, ... }` entries
- [ ] `SKILL.md` is present
- [ ] No raw `instructions` block embedded inside the `files` entry — instructions live in the top-level `instructions` field

### F3. Auto-publish on visibility flip

Requires `--auth on` (visibility flips are no-ops under auth off; see `references/auth.md`). After flipping `visibility` from `private` to `public`:

- [ ] A new active version is created (visible via `activeVersionId` change on GET)
- [ ] No 5xx errors

## Frontmatter handling (skills.sh + library copies)

If this skill was installed from skills.sh or copied from the library:

- [ ] `instructions` does NOT begin with `---` (frontmatter stripped at install/copy)
- [ ] `metadata.origin.type` is `skills-sh` or `library-copy` (see `references/registry.md`)

## Edge cases (optional)

### Duplicate skill name

```bash
curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{"name": "Dupe Skill", "description": "first", "instructions": "first instructions"}' | jq '.id'

curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{"name": "Dupe Skill", "description": "second", "instructions": "second instructions"}' | jq .
```

- [ ] Second create either succeeds (different IDs, slugified path collision handled) or returns a `4xx` with a clear message
- [ ] No server crash

## Checklist

- [ ] Create skill (`instructions` required)
- [ ] Get skill by ID
- [ ] List skills with `page=0`
- [ ] Partial PATCH returns `500` (known regression)
- [ ] Create second skill
- [ ] Publish requires `skillPath` in body; happy path returns 200, missing `skillPath` returns 400, missing directory returns 404
- [ ] Delete returns 200; follow-up GET returns 404
- [ ] Filesystem persistence under `.mastra/workspace/skills/...`
- [ ] (Optional) Duplicate-name handling
