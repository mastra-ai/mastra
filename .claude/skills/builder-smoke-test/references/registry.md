# Skill Registry (skills.sh + Library Copy)

Two paths to acquire skills from outside your own authored set:

1. **External registry** — currently only `skills.sh`, opt-in via `builder.registries.skillsSh.enabled`. Browse + install proxies to skills.sh and persists a stored skill with `metadata.origin = { type: 'skills-sh', ... }`.
2. **Library Copy** — any authenticated user can copy a public stored skill they don't own. The copy is a fresh private stored skill with `metadata.origin = { type: 'library-copy', sourceSkillId, sourceAuthorId, copiedAt }`.

## Source-of-truth

- Routes: `GET /editor/builder/registries`, `GET /editor/builder/registries/:id/search|popular|preview`, `POST /editor/builder/registries/:id/install`.
- skills.sh enabled flag: `builder.registries.skillsSh.enabled` (default `false`).
- Origin schema: `packages/server/src/server/schemas/stored-skills.ts` (`skillOriginSchema` discriminated union, types `skills-sh` and `library-copy`).
- Library page: `/agent-builder/library`.

## Steps — skills.sh registry

These steps assume `skillsSh.enabled = true`. **The scaffolded project ships with `registries` unset (skills.sh disabled by default).** Under that config, registry surfaces are hidden in UI and `/editor/builder/registries/skills-sh/*` returns `404`. Run the registries-list step (step 1) to confirm the disabled-path behavior, then mark steps 2–5 as `⏭️ skills.sh disabled` and continue. Only run the full registry walk if you've explicitly enabled `builder.registries.skillsSh.enabled` in `src/mastra/index.ts` and restarted.

### 1. Registries list

```bash
curl -s "$BASE/editor/builder/registries" | jq .
```

- [ ] If enabled: `[{ id: 'skills-sh', enabled: true, label: '...' }]`
- [ ] If disabled: the entry is still present with `enabled: false` (e.g. `[{ id: 'skills-sh', enabled: false }]`) — the registry is listed but not callable. Search/popular/preview/install on a disabled registry return `404` (`Registry not found`).

### 2. Search

```bash
curl -s "$BASE/editor/builder/registries/skills-sh/search?q=react" | jq '.skills | length'
```

- [ ] Returns 200 with at least one result for a common term
- [ ] Each result has `id`, `name`, `installs`, `topSource`

### 3. Popular

```bash
curl -s "$BASE/editor/builder/registries/skills-sh/popular" | jq '.skills | length'
```

- [ ] Returns 200 with the popular list

### 4. Preview

Pick a skill from search/popular. Preview takes the GitHub coordinates as query params (`owner`, `repo`, `path` — where `path` is the skill name within the repo). Source: `packages/server/src/server/schemas/builder-registry.ts` `builderRegistryPreviewQuerySchema`.

```bash
curl -s "$BASE/editor/builder/registries/skills-sh/preview?owner=OWNER&repo=REPO&path=SKILLNAME" | jq .
```

- [ ] Returns `name`, `description`, `instructions` (frontmatter stripped), `files` tree
- [ ] Instructions do NOT start with `---` (frontmatter has been stripped)

### 5. Install

Install body is `{ owner, repo, skillName, visibility? }`. Source: `packages/server/src/server/schemas/builder-registry.ts` `builderRegistryInstallBodySchema`.

```bash
curl -s -X POST "$BASE/editor/builder/registries/skills-sh/install" \
  -H 'Content-Type: application/json' \
  -d '{ "owner": "OWNER", "repo": "REPO", "skillName": "SKILLNAME" }' | jq .
```

- [ ] Returns 200/201 with `{ storedSkillId, name, filesWritten }`
- [ ] Subsequent `GET /stored/skills/<storedSkillId>` shows `metadata.origin.type = "skills-sh"`
- [ ] `metadata.origin.owner`, `repo`, `skillName`, `installedAt` present
- [ ] `instructions` does NOT start with `---`

Record `INSTALLED_SKILL_ID = storedSkillId`.

### 6. Collision

Re-run the same install:

```bash
curl -s -o /tmp/install-err.json -w '%{http_code}\n' \
  -X POST "$BASE/editor/builder/registries/skills-sh/install" \
  -H 'Content-Type: application/json' \
  -d '{ "owner": "OWNER", "repo": "REPO", "skillName": "SKILLNAME" }'
cat /tmp/install-err.json | jq .
```

- [ ] 409 Conflict
- [ ] Error payload includes `existingSkillId` (used by UI for "Open existing")

### 7. UI: Browse dialog

Navigate to `/agent-builder/skills`.

- [ ] "Browse registry" button visible only when registries are enabled (gated by `useBuilderRegistries`)
- [ ] Clicking opens dialog with search + popular tabs
- [ ] Selecting a skill shows preview pane (markdown rendered)
- [ ] "Install" creates a new stored skill, dialog closes, list refreshes
- [ ] On collision, toast offers "Open existing" → navigates to the stored skill

### 8. Origin badge on skill list

In `/agent-builder/skills`:

- [ ] Installed skill shows an origin badge (skills.sh logo or "skills.sh")
- [ ] Badge links to the source on hover/click

## Steps — Library Copy flow

> **There is no dedicated copy endpoint.** Library "Copy" is implemented client-side as a regular `POST /stored/skills` with the source's fields plus `metadata.origin = { type: 'library-copy', sourceSkillId, sourceAuthorId, copiedAt }`. Don't grep the server for `/copy`; verify origin metadata on the resulting record instead. The action goes through the normal create path and is gated by `stored-skills:write`; the view-page Copy button uses the same check (`canCopy = !rbacEnabled || hasPermission('stored-skills:write')` in `pages/agent-builder/skills/view.tsx`). The scaffold grants member that perm, so admin and member both see the button and exercise the copy. Viewer doesn't see the button — mark Copy steps `n/a — role lacks stored-skills:write` under viewer.

> **Setup note — requires multi-user data:** The Library Copy flow requires at least one public skill **owned by a different user** so the current user can "Copy" it. A fresh scaffold has none. Options:
>
> 1. **Recommended:** run `bash .claude/skills/builder-smoke-test/scripts/seed-multi-user.sh` after the server has booted at least once. This inserts `smoke-seed-public-skill` (public) and `smoke-seed-private-skill` (private) owned by a fake `user_seed_other`, so all checklist items below become exercisable without a second WorkOS account.
> 2. **Auth-on with a second account:** sign in as a different WorkOS user, publish a skill as public, sign back in as the test user and Copy it.
> 3. **Skip:** under `--auth off`, every API-created skill resolves to the same `null` author, so the Copy affordance won't appear naturally. If you didn't seed and don't have a second account, mark these steps `n/a — multi-user data not available` and move on; do not flag them as failures.

### 9. Library page lists public skills

Navigate to `/agent-builder/library`.

- [ ] Shows at least one public skill authored by someone other than current user (skip with a note if none exist — see setup note above)
- [ ] All shown skills are public and authored by someone other than current user

### 10. Copy a public skill

Click a skill not authored by you.

- [ ] Detail dialog opens in read-only mode
- [ ] "Copy" button visible (replaces Edit for non-owners on public skills)
- [ ] Click "Copy" → name prompt dialog appears
- [ ] Default name is `<source-name>-copy`
- [ ] Submit → new private stored skill created
- [ ] Toast confirms; clicking it navigates to the new skill

### 11. Verify origin metadata via API

```bash
curl -s "$BASE/stored/skills/<copiedSkillId>" | jq '.metadata.origin'
```

- [ ] `type` is `"library-copy"`
- [ ] `sourceSkillId` matches the original
- [ ] `sourceAuthorId` matches the original author
- [ ] `copiedAt` is an ISO timestamp

### 12. Origin badge for copies

In `/agent-builder/skills`:

- [ ] Copied skill shows a "copied" badge with tooltip "Copied from <original name>"

### 13. Collision on name

Try to copy the same source skill twice without renaming:

- [ ] Second copy with same name returns 409
- [ ] UI offers to pick a new name

## Cleanup

```bash
curl -s -X DELETE "$BASE/stored/skills/$INSTALLED_SKILL_ID" | jq .
# delete any library copies created above
```

## Checklist

### skills.sh

- [ ] Registries list reflects enabled flag
- [ ] Search returns results
- [ ] Popular returns results
- [ ] Preview strips frontmatter
- [ ] Install persists with `metadata.origin.type = 'skills-sh'`
- [ ] Re-install returns 409 with `existingSkillId`
- [ ] UI Browse button gated by enabled registries
- [ ] Origin badge renders on installed skill

### Library Copy

- [ ] Library page shows non-owned public skills
- [ ] Copy button visible for non-owners
- [ ] Copy produces a private skill with `library-copy` origin
- [ ] Origin badge renders on copied skill
- [ ] Name collision returns 409
