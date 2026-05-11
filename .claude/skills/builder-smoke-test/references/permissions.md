# Permissions / RBAC

Verify role-based gating across Studio and Agent Builder. Covers route-level RBAC, component-level gating (#16271), "Preview as Role" header (#15864), and the auth-off bypass (#16107).

## Default roles

| Role   | Powers (summary)                                         |
| ------ | -------------------------------------------------------- |
| viewer | `*:read`                                                 |
| member | `*:read`, `*:execute`                                    |
| admin  | `*:read`, `*:write`, `*:execute`, `*:publish`, `*:share` |
| owner  | `*`                                                      |

Public stored skills/agents short-circuit read checks (see authorship.ts). Auth disabled bypasses role checks entirely.

## "Preview as Role" header

Admins can preview the UI/API as another role using:

```
X-Mastra-Role-Preview: viewer
```

This must be a real admin's session. Non-admins setting this header are ignored.

## Steps

### 1. RBAC on — read works for viewer

With auth on, log in as a user with the `viewer` role (or use role-preview from an admin session):

```bash
SESSION='Cookie: <session>'
curl -s -H "$SESSION" -H 'X-Mastra-Role-Preview: viewer' "$BASE/stored/agents" | jq '.agents | length'
```

- [ ] 200, list returns
- [ ] Public agents visible
- [ ] Private agents owned by other users are NOT visible

### 2. RBAC on — write blocked for viewer

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "$SESSION" -H 'X-Mastra-Role-Preview: viewer' \
  -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Viewer Cannot Create", "instructions": "x" }'
```

- [ ] 403

### 3. RBAC on — write allowed for member/admin

Switch role-preview to `member` (members have `:execute` but not `:write`) and `admin`:

- [ ] `member` POST → 403 (no `:write`)
- [ ] `admin` POST → 200/201

### 4. UI gating in Studio

In browser, with role-preview = `viewer`:

- [ ] Studio sidebar hides "Agent Builder" link (per #15639)
- [ ] Agent pages hide create/edit/delete affordances
- [ ] Settings hidden

With role-preview = `admin`:

- [ ] All links visible

### 5. UI gating in Agent Builder

With role-preview = `viewer`:

- [ ] `/agent-builder` route either denies access or shows read-only views
- [ ] Sidebar gating: `Skills` hidden (no `stored-skills:write`), `Favorites` hidden (no read on stars resource), `Infra` hidden (no `infrastructure:read`). The top-level `Agents` and `Library` entries remain visible because viewer keeps `*:read`.
- [ ] Create/Edit/Delete buttons hidden
- [ ] Attempting to navigate to `/agent-builder/agents/:id/edit` redirects to view (or denies)
- [ ] Impersonation banner shows current preview role + "Exit preview" affordance

With role-preview = `member`:

- [ ] Can read; can execute (chat)
- [ ] Cannot edit / create / publish / share

### 6. Edit gates by ownership + write permission

Create an agent as user A. As user B (admin, role-preview = admin):

- [ ] Can read user A's private agent? Only if public, admin bypass, or has `:read`
- [ ] Can edit? Only if owner OR admin bypass
- [ ] Edit page for non-owner non-admin should redirect/deny

### 7. Auth-off bypass

Disable auth (comment out `server.auth`/`rbac`), restart. Everything should be reachable without role checks (#16107).

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/stored/agents"
```

- [ ] 200
- [ ] UI loads without login
- [ ] All affordances visible

### 8. Visibility flip + publish semantics

The `:share` and `:publish` actions on `stored-skills` / `stored-agents`
aren't wired into route `requiresPermission`. Instead, the handler calls
`assertShareAccess(ctx, record)` (and equivalent for publish) inside the
PATCH/POST handler. That helper allows the action when **any** of these
hold:

1. The record has no owner (legacy/unowned).
2. The caller is the record's `authorId`.
3. The caller has the admin-bypass permission for the resource
   (`stored-skills:write` with no record filter).
4. The caller explicitly holds `<resource>:share` or `<resource>:publish`
   in their role grants.

Verify the resulting ownership/admin behavior via the API:

- [ ] Owner can flip visibility on their own skill: `PATCH
      /stored/skills/:id` with `{"visibility":"public"}` returns 200 and
      the response has `visibility: "public"`.
- [ ] Admin can flip visibility on a skill they don't own: same PATCH
      against another user's skill returns 200.
- [ ] Viewer / member can't flip visibility on a skill they don't own:
      same PATCH returns 403 with a JSON error body (no stack trace,
      no HTML).
- [ ] Auth-off mode bypasses these checks (handler short-circuits when
      `getCallerAuthorId(ctx)` is `null`); record this as "auth-off
      bypass" in the report rather than testing the same matrix.

## Checklist

- [ ] Viewer can read; cannot write
- [ ] Member can read + execute; cannot write
- [ ] Admin can read + write + execute + publish + share
- [ ] Studio sidebar gated for viewer
- [ ] Agent Builder sidebar gated for viewer / member
- [ ] Edit page redirects when read-only
- [ ] Impersonation banner + Exit preview present
- [ ] Auth off bypasses all role checks
- [ ] Visibility flips gated by ownership / admin
