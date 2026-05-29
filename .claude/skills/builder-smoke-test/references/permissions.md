# Permissions / RBAC

Verify role-based gating across Studio and Agent Builder. Covers route-level RBAC, component-level gating (#16271), the UI-only role impersonation feature (#15864), and the auth-off bypass (#16107).

## Default roles

The scaffolded project configures its own WorkOS `roleMapping` in
`src/mastra/auth.ts` (so it doesn't depend on `DEFAULT_ROLES` in core):

| Role     | Permission grants                                                                              |
| -------- | ---------------------------------------------------------------------------------------------- |
| `owner`  | `*` (everything, including delete)                                                             |
| `admin`  | `*` (owner-equivalent via WorkOS mapping; see note below)                                      |
| `member` | `*:read`, `*:execute`, `stored-agents:write`, `stored-skills:write`, `stored-workspaces:write` |
| `viewer` | `*:read`                                                                                       |

Public stored skills/agents short-circuit read checks (see `authorship.ts`). Auth disabled bypasses role checks entirely.

> **Member write grants are narrow.** Members can create/PATCH their own stored agents/skills/workspaces (so Library Copy, Stars, and edit flows are exercisable under a non-admin role), but cannot `:publish`, `:delete`, or `:share`. Ownership rules still apply: a member PATCHing another author's record gets 403. This mapping lives in the scaffolded project's `auth.ts` — `DEFAULT_ROLES` in core is unchanged.

> **WorkOS admin → owner-equivalent.** The scaffold maps `admin` → `['*']`, so a WorkOS-provisioned admin in this project carries `permissions: ["*"]` and passes DELETE checks. Treat admin as owner-equivalent for matrix purposes.

## Picking the role to test

Under `--auth on`, the smoke test runs as whichever role the **logged-in WorkOS user actually has**. The `--role` flag (default `admin`) is the agent's expectation; setup asserts it matches `/api/auth/me`'s `roles` field and stops if it doesn't.

**There is no server-side "preview as role" header in this build.** The "View as role" feature in the UI is purely frontend state (see `references/ui.md` — Impersonation UI). It does not change what the API returns. To exercise role gating at the API layer, the logged-in user must actually have that role.

If the user is logged in as `admin` and wants to test viewer behavior, they have two options:

1. Change their WorkOS role to `viewer`, restart `mastra dev`, re-run with `--role viewer`.
2. Run with `--role admin` and exercise the UI-only impersonation flow (covered in `references/ui.md`).

## Role expectation matrix

Pass criteria per role for representative endpoints. The agent uses this to set expected status codes per section when `--role` is non-admin.

| Endpoint / action                       | owner | admin | member | viewer |
| --------------------------------------- | ----- | ----- | ------ | ------ |
| `GET /stored/agents`                    | 200   | 200   | 200    | 200    |
| `GET /stored/skills`                    | 200   | 200   | 200    | 200    |
| `POST /stored/agents` (create)          | 200   | 200   | 200    | 403    |
| `POST /stored/skills` (create)          | 200   | 200   | 200    | 403    |
| `PATCH /stored/agents/:id` (own)        | 200   | 200   | 200    | 403    |
| `PATCH /stored/agents/:id` (other's)    | 200   | 200   | 404    | 404    |
| `DELETE /stored/agents/:id` (own)       | 200   | 200   | 403    | 403    |
| `PATCH /stored/skills/:id` `visibility` | 200   | 200   | 200    | 403    |
| `POST /stored/skills/:id/publish`       | 200   | 200   | 403    | 403    |
| `POST /agents/:id/chat` (execute)       | 200   | 200   | 200    | 403    |
| `GET /editor/builder/infrastructure`    | 200   | 200   | 200    | 200    |
| `PUT /stored/agents/:id/favorite`       | 200   | 200   | 200    | 200    |

Member create/PATCH on own works because the scaffold grants `stored-{agents,skills,workspaces}:write`. Publish/delete/share remain admin-only. **Member PATCH on another author's record returns `404 Not Found`** — the visibility/ownership filter hides the row before the handler runs, so non-owners can't tell the difference between "doesn't exist" and "forbidden". This is the standard REST "don't reveal existence" pattern.

## Steps

### 1. Confirm the logged-in role

```bash
curl -s -H "$SESSION" "$BASE/auth/me" | jq '{roles, permissions}'
```

- [ ] `roles` includes the value passed via `--role`
- [ ] `permissions` matches the grants for that role (see Default roles table)

If mismatch, halt — see `references/auth.md` step 1b.

### 2. Read works for every role

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "$SESSION" "$BASE/stored/agents"
curl -s -o /dev/null -w '%{http_code}\n' -H "$SESSION" "$BASE/stored/skills"
```

- [ ] Both 200 regardless of role
- [ ] Body is JSON; not HTML, not a stack trace
- [ ] Private agents/skills owned by _other_ users are absent from the list (unless caller is admin/owner)

### 3. Write gated by role

Try the matrix's POST row for the current `--role`. Expected codes per role are in the matrix above.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "$SESSION" \
  -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Role Gating Test", "instructions": "x", "model": { "provider": "openai", "name": "gpt-4o-mini" } }'
```

- [ ] Status matches the matrix for `--role`
- [ ] 403 bodies are JSON with an error message (no stack trace, no HTML)

### 4. Execute and write differ by resource (member case)

If `--role member`:

- [ ] `POST /stored/agents` → 200 (has `stored-agents:write`)
- [ ] `POST /agents/:id/chat` against an existing public agent → 200 (has `:execute`)
- [ ] `POST /stored/skills/:id/publish` against own draft → 403 (no `:publish`)
- [ ] `PATCH /stored/skills/:id` on another author's row → 403 (ownership check, not perm check)

If `--role viewer`:

- [ ] `POST /agents/:id/chat` → 403 (no `:execute`)
- [ ] `POST /stored/agents` → 403 (no `:write`)

### 5. Delete is owner-only

The scaffold maps `admin` → `['*']`, so an admin in this project passes DELETE checks (owner-equivalent). Only `viewer` and `member` see 403 on DELETE.

- [ ] `--role owner` or `--role admin`: `DELETE /stored/agents/:id` on own → 200
- [ ] `--role member`: same DELETE → 403
- [ ] `--role viewer`: same DELETE → 403

If the matrix and the live response disagree, that is the finding — file it, don't "correct" the matrix without checking the scaffold's `roleMapping` in `auth.ts` first.

### 6. Visibility flip + publish semantics

The `:share` and `:publish` actions on `stored-skills` / `stored-agents` aren't wired into route `requiresPermission`. Instead, the handler calls `assertShareAccess(ctx, record)` (and equivalent for publish) inside the PATCH/POST handler. That helper allows the action when **any** of these hold:

1. The record has no owner (legacy/unowned).
2. The caller is the record's `authorId`.
3. The caller has the admin-bypass permission for the resource (`stored-skills:write` with no record filter).
4. The caller explicitly holds `<resource>:share` or `<resource>:publish` in their role grants.

Verify via the API:

- [ ] Owner can flip visibility on their own skill: `PATCH /stored/skills/:id` with `{"visibility":"public"}` returns 200 and the response has `visibility: "public"`.
- [ ] Admin can flip visibility on a skill they don't own: same PATCH against another user's skill returns 200.
- [ ] Viewer / member can't flip visibility on a skill they don't own: same PATCH returns 403 with a JSON error body.
- [ ] Auth-off mode bypasses these checks (handler short-circuits when `getCallerAuthorId(ctx)` is `null`); record this as "auth-off bypass" rather than testing the matrix.

### 7. Auth-off bypass

Disable auth (comment out `AUTH_PROVIDER` in `.env`), restart. Everything should be reachable without role checks (#16107).

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/stored/agents"
curl -s "$BASE/auth/me"
```

- [ ] `/stored/agents` returns 200
- [ ] `/auth/me` returns 200 with body `null` (not 401, not a user object) — the route resolves a missing caller to `null` rather than rejecting
- [ ] UI loads without login
- [ ] All affordances visible
- [ ] Created records have `authorId: null`

### 8. UI gating (per-role sidebar / affordances)

In the browser, while logged in as the `--role` user:

- [ ] Sidebar items matching the role's grants are visible; ungranted items are hidden
- [ ] Create/Edit/Delete buttons match the role's grants
- [ ] Direct nav to a gated route (`/agent-builder/agents/:id/edit` for viewer) redirects to the read-only view or denies

If `--role admin` (or `owner`), also run the **UI Impersonation** subset in `references/ui.md` — that's the only honest way to exercise viewer/member UI gating without re-authenticating.

## Checklist

- [ ] `/auth/me` roles match `--role`
- [ ] Reads pass for all roles
- [ ] Writes pass/fail per the matrix
- [ ] Execute pass/fail per the matrix (member ≠ viewer)
- [ ] Delete is owner-only
- [ ] Visibility flips gated by ownership / admin-bypass / explicit `:share`
- [ ] Auth off bypasses all role checks
- [ ] UI affordances narrow with role
