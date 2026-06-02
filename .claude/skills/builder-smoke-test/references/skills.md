# Skill CRUD & Visibility

Test stored skill create, read, update, delete, visibility, publish, and filesystem persistence.

> **Visibility is auth-on-only.** With `--auth off`, the server forces `visibility: "public"` and `authorId: null` on every create / PATCH. Visibility assertions live in `references/auth.md` and should only run under `--auth on`.

> **Pagination is 0-indexed.** `page=0` is the first page.

> **Capability gate.** Steps 1, 3, 5, 7, 8 require `stored-skills:write`. The scaffold grants this to owner, admin, and member; viewer does not have it. Under `--role viewer`, mark those steps `n/a — role lacks stored-skills:write` and run only the read-side steps (2, 4 GET, 6, 9).
>
> **Member is narrower than admin for skills.** `stored-skills:publish` and `stored-skills:delete` are **not** granted to member in the scaffold — only owner/admin have them. Under `--role member`, any `POST /stored/skills/:id/publish` or `DELETE /stored/skills/:id` step should return `403 Missing required permission: stored-skills:{publish,delete}`. Treat that 403 as the expected outcome for member; don't file it. Member PATCH on a **different** author's row returns `404 Not Found` (ownership filter hides the row before the handler — see `references/permissions.md`).

## Endpoints

| Endpoint                      | Method | Purpose                                    |
| ----------------------------- | ------ | ------------------------------------------ |
| `/stored/skills`              | POST   | Create a stored skill                      |
| `/stored/skills`              | GET    | List stored skills (paginated)             |
| `/stored/skills/:id`          | GET    | Read a single stored skill                 |
| `/stored/skills/:id`          | PATCH  | Update fields on a stored skill            |
| `/stored/skills/:id`          | DELETE | Delete a stored skill                      |
| `/stored/skills/:id/publish`  | POST   | Publish a skill from a filesystem path     |
| `/stored/skills/:id/favorite` | PUT    | Favorite (see `references/favorites.md`)   |
| `/stored/skills/:id/favorite` | DELETE | Unfavorite (see `references/favorites.md`) |

The full schema definitions live in `packages/server/src/server/schemas/stored-skills.ts`. Treat that file as the source of truth for request and response shapes.

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
- [ ] `name` and `description` match the request
- [ ] `id` is present; record it as `SKILL_ID=<id>`

> `name`, `description`, and `instructions` are all required by the schema. Omitting any of them returns `400 Invalid input: expected string, received undefined`.

### 2. Get the skill

```bash
curl -s $BASE/stored/skills/$SKILL_ID | jq .
```

- [ ] Returns 200
- [ ] `name`, `description`, and `instructions` match what was created
- [ ] `createdAt` and `updatedAt` are ISO timestamps

### 3. List skills

```bash
curl -s "$BASE/stored/skills?page=0&perPage=50" | jq '{ total, page, perPage, count: (.skills | length) }'
```

- [ ] `total >= 1`
- [ ] `$SKILL_ID` appears in the `skills` array

### 4. Update skill metadata

```bash
curl -s -o /tmp/skill-patch.json -w "%{http_code}\n" -X PATCH $BASE/stored/skills/$SKILL_ID \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Smoke Skill",
    "description": "A test skill created during smoke testing",
    "instructions": "Skill instructions for the smoke test."
  }'
cat /tmp/skill-patch.json | jq .
```

- [ ] Returns 200
- [ ] `name` reflects the updated value
- [ ] `description` and `instructions` are unchanged

A single-field partial PATCH (e.g. `{"description": "…"}` alone) is supported and returns 200 with only that field changed. If a partial PATCH ever returns a non-2xx, log the exact status and body in the run report — that would be a regression.

### 5. Create a second skill

```bash
curl -s -X POST $BASE/stored/skills \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Second Smoke Skill",
    "description": "Another skill for smoke testing",
    "instructions": "Second skill instructions."
  }' | jq '{ id }'
```

- [ ] Returns 200 with an `id`; record it as `SKILL_ID_2=<id>`

### 6. List skills — verify both

```bash
curl -s "$BASE/stored/skills?page=0&perPage=50" | jq '[.skills[].id] | map(select(. == $a or . == $b)) | length' \
  --arg a "$SKILL_ID" --arg b "$SKILL_ID_2"
```

- [ ] Returns `2`

### 7. Publish skill

`POST /stored/skills/:id/publish` requires a `skillPath` pointing at a server-side directory containing a `SKILL.md`. The server applies a path-traversal guard; see `publishStoredSkillBodySchema` in `packages/server/src/server/schemas/stored-skills.ts`.

```bash
# Empty body — should fail validation
curl -s -o /tmp/publish-empty.json -w "%{http_code}\n" -X POST $BASE/stored/skills/$SKILL_ID/publish \
  -H 'Content-Type: application/json' -d '{}'
cat /tmp/publish-empty.json | jq .
```

- [ ] Returns 400 with a validation error on `skillPath`

```bash
# Provide an in-tree skillPath for the scaffolded project. The allowed base is
# resolved from the server's cwd (the scaffolded project's src/mastra/public dir).
ALLOWED_BASE="${SKILLS_BASE_DIR:-$HOME/mastra-builder-smoke-tests/builder-smoke/src/mastra/public}"
ls "$ALLOWED_BASE" 2>/dev/null
SKILL_PATH="$ALLOWED_BASE/skills/$SKILL_ID"

curl -s -o /tmp/publish.json -w "%{http_code}\n" -X POST $BASE/stored/skills/$SKILL_ID/publish \
  -H 'Content-Type: application/json' \
  -d "{\"skillPath\": \"$SKILL_PATH\"}"
cat /tmp/publish.json | jq .
```

- [ ] If the directory exists with a valid `SKILL.md`, returns 200 with a persisted record (note any new `activeVersionId`)
- [ ] If the directory doesn't exist, log the actual status and message; do not assume a specific code

> **Frontmatter is authoritative on publish.** Publish reads `SKILL.md` frontmatter and rewrites the stored record's `name` / `description` / `instructions` from disk. If you PATCHed those fields and then publish, the patched values are overwritten by whatever the frontmatter says. The body's `instructions` returned by a subsequent GET will also be frontmatter-stripped from the file contents (no `---` block).

### 8. Delete skills (cleanup)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/skills/$SKILL_ID    # → 200
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $BASE/stored/skills/$SKILL_ID_2  # → 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/stored/skills/$SKILL_ID              # → 404
```

### 9. Non-owner visibility filtering (requires `seed-multi-user.sh`)

Requires `--auth on` and the seeded rows from `seed-multi-user.sh` (run from SKILL.md execution flow step 4). The seed inserts two skills owned by `user_seed_other`: `smoke-seed-public-skill` (public) and `smoke-seed-private-skill` (private). The current user is **not** the owner.

```bash
# Public seeded skill: should be visible to the current user
curl -s -H "$SESSION" "$BASE/stored/skills/smoke-seed-public-skill" | jq '{id, visibility, authorId}'
# Private seeded skill: should be filtered (404)
curl -s -o /dev/null -w "%{http_code}\n" -H "$SESSION" "$BASE/stored/skills/smoke-seed-private-skill"
```

- [ ] Public seed: 200, `visibility: "public"`, `authorId: "user_seed_other"`
- [ ] Private seed: 404 (non-owner cannot read another user's private skill)
- [ ] If you got 200 on the private seed: real bug, log it as a product issue with the response body

Also verify the list endpoint applies the same filter:

```bash
curl -s -H "$SESSION" "$BASE/stored/skills?perPage=100" | jq '.skills | map(.id) | sort'
```

- [ ] `smoke-seed-public-skill` is in the list
- [ ] `smoke-seed-private-skill` is **not** in the list (unless caller is owner-equivalent / admin with `*`)

## Filesystem persistence (#16000)

The publish flow is the path that materializes `SKILL.md` (and any `references/`, `scripts/`, `assets/` subdirs) on disk. Verify by inspecting filesystem state before and after a successful publish.

The relevant field on the GET response is `files: FileNode[]` (each node has `name`, `type`, `content?`, `children?`). See `storedSkillSchema` in `packages/server/src/server/schemas/stored-skills.ts`.

### F1. Files on plain create

```bash
curl -s "$BASE/stored/skills/$SKILL_ID" | jq '.files'
```

- [ ] Record the value. Expected: absent or empty on plain create (no filesystem materialization until publish).

### F2. Files after publish (when applicable)

For any skill that was successfully published in step 7:

```bash
curl -s "$BASE/stored/skills/$SKILL_ID" | jq '.files'
```

- [ ] `files` is populated and includes a `SKILL.md` entry (`name: "SKILL.md", type: "file"`)
- [ ] `instructions` is not duplicated inside the file node's `content`

### F3. Auto-publish on visibility flip (requires a registered `skillPath`)

Requires `--auth on`. See `references/auth.md`.

> **Precondition.** A visibility flip only auto-publishes when the skill has source on disk — meaning it was created with a `skillPath` _or_ a prior `POST /stored/skills/:id/publish` set one. Without a registered path, `visibility: "public"` is accepted (200), the row is now listed as public, but `activeVersionId` stays `null` and no new version is created. Visibility and publication are **independent fields by design**.
>
> Run this step against a skill you created from a real on-disk directory under `SKILLS_BASE_DIR`. If you flipped visibility on a "plain create" skill (no `skillPath`), expect 200 + unchanged `activeVersionId`, not a new version.

- [ ] Flipping `visibility` from `private` to `public` on a skill **with a registered `skillPath`** creates a new active version (`activeVersionId` changes on GET)
- [ ] Same flip on a skill **without** a registered `skillPath` returns 200 but `activeVersionId` stays `null` — that's the intended contract, not a bug
- [ ] No 5xx errors during the flip in either case

## Frontmatter handling (skills.sh + library copies)

If this skill was installed from skills.sh or copied from the library, also verify:

- [ ] `instructions` does NOT begin with `---` (frontmatter stripped at install/copy)
- [ ] `metadata.origin.type` is `skills-sh` or `library-copy` with a `sourceSkillId`

See `references/registry.md` for the install flow.

## Checklist

- [ ] Create skill (`name`, `description`, `instructions` all required)
- [ ] Get skill by ID
- [ ] List skills with `page=0`
- [ ] Update skill metadata (full-body PATCH)
- [ ] Create + list a second skill
- [ ] Publish: empty body validation, in-tree `skillPath` behavior
- [ ] Delete returns 200; follow-up GET returns 404
- [ ] Inspect `files` field before and after publish
- [ ] (Optional) Duplicate-name handling
