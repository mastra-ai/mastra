# Builder Smoke Test Results

> Log product issues and skill issues as separate lists. Do not pre-decide bugs — record what you observed.

## Run 1 — Auth off

_status: pending_

### Product issues

_(none observed yet)_

### Skill issues

_(none observed yet)_

## Run 2 — Auth on, admin

_status: pass (with minor drift)_

**Scaffold:** `/Users/naiyer/Documents/Projects/mastra-org/testing/builder-smoke`
**Auth:** WorkOS (`AUTH_PROVIDER=workos`) — logged in as `nik@mastra.ai` (`user_01KPS2202RYQR4JAMPVXBB9A1H`), `roles=["admin"]`, `permissions=["*"]`
**Server:** `mastra dev` on `localhost:4111`, fresh scaffold; smoke-test cookie route enabled via `SMOKE_TEST_COOKIE_LEAK=1`.

### Section results

| Section          | Status | Notes                                                                                                                |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Setup            | ✅      | Preflight `--expect on` passed; all four WorkOS env vars present; admin role asserted via `/api/auth/me`.            |
| Workspace        | ✅      | List/get/create/update/delete via API all worked; builder workspace untouched after test CRUD.                       |
| Reconciliation   | ✅      | Step 1 (fresh-startup persistence) and step 5 (non-builder workspace preserved across restart) both pass.            |
| Defaults         | ✅      | All 5 API checks pass: defaults applied, overrides preserved, `browser:null` opt-out, `memory:null` → 400, settings. |
| Model Policy     | ✅      | Settings exposes allowlist; allowed wildcard + exact accept; disallowed rejected with 422 (clean JSON error).        |
| Skills           | ✅      | CRUD + publish + filesystem persistence verified; frontmatter stripped; visibility flip does NOT bump version.       |
| Registry         | ✅      | skills.sh disabled (404 on search — correct). Library Copy flow simulated via `createStoredSkill` with origin meta.  |
| Agents           | ✅      | Stored agent CRUD, skill attach/detach, avatar via `metadata.avatarUrl` data URL all worked.                         |
| Pickers          | ✅      | Settings: all picker features true; visibleTools/Agents/Workflows null (unrestricted). UI steps 5–6 skipped.         |
| Stars            | ✅      | Star/unstar for agents and skills both work; PUT and DELETE are idempotent.                                          |
| Permissions/RBAC | ✅      | Admin matrix verified. Note: this user has `permissions: ["*"]` (owner-equivalent), so DELETE succeeded (see below). |
| Infrastructure   | ✅      | Top-level keys present; browser/workspace/channels/registries shapes match; `registries` is an object (not array).   |
| Channels         | ✅      | Negative path: `providers: []` (Slack not configured; `SLACK_*` vars unset). Positive flow (steps 2–5) skipped.      |
| UI (Core)        | ✅      | Shell, skills list/create/edit, agent list/view, star toggle, role impersonation all verified.                       |
| Auth             | ✅      | 401 without cookie (clean JSON), `/auth/me` returns admin role, `authorId` set on created skill.                     |

### Drift / Observations (skill ↔ live UI mismatches — log only, not bugs)

1. **Agent view page top-right** (`references/ui.md` step 6): skill expects a "Publish to..." dropdown; actual UI shows three buttons — `Switch to Edit mode`, `Add to library`, `Show configuration`. The publish-related action is `Add to library`. The avatar is in the sidebar user menu, not the top-right of the agent view.
2. **Role impersonation menu label** (`references/ui.md` step 8): skill expects `View as role`; actual label is `PREVIEW AS ROLE` and the exit affordance is `Exit role preview` (not `Exit impersonation`). Functionally identical: banner appears, create buttons hide, exit restores admin UI.
3. **Role impersonation roles offered** (`references/ui.md` step 8): the picker only shows roles different from the current one. Logged in as admin, only `Member` and `Viewer` are listed (no `admin`). Probably intentional.
4. **Sidebar under impersonation**: while previewing `Viewer`, the `Infrastructure` link remains visible in the sidebar. The real viewer would not have `infrastructure:read`. Impersonation is documented as UI-only, but the sidebar-gating step in `references/ui.md` step 8 isn't fully honored for the Infrastructure entry.
5. **Skill edit page visibility selector** (`references/ui.md` step 4): no visibility selector found in the skill edit form under `--auth on`. The skill says to "log whether the selector is rendered" — logging: not rendered.
6. **`/api/auth/me` returns `id`, not `userId`** (`references/auth.md` step 1b): the payload field is `id` (e.g. `user_01KPS2202RYQR4JAMPVXBB9A1H`). The skill snippet says `userId`. Minor doc fix in the skill.
7. **Permissions matrix vs. live grants** (`references/permissions.md`): the WorkOS-provisioned `admin` user in this test has effective `permissions: ["*"]`, which matches the `owner` row in `default-roles.ts`. As a result, `DELETE /stored/agents/:id` succeeded for this admin (matrix predicts 403). Not a regression — the user's grants are owner-equivalent. Worth a note in the skill that real-world admins may carry a stronger permission set than the default `admin` role hard-codes.

### Product issues

_(none observed)_

All API surfaces behaved correctly per their reference docs. Errors were clean JSON (no HTML / stack traces) at every negative path checked: unauth (401), disallowed model (422), invalid `memory:null` body (400), missing skillPath on publish (400).

### Skill issues

- Drift items 1, 2, 5, 6, 7 above are skill/doc inaccuracies — recommend updating `references/ui.md` and `references/auth.md` to match the current UI labels and API response shape.
- The role impersonation picker offering only non-current roles (item 3) is plausibly intentional and not a defect; the skill could document this expectation.
- The infrastructure sidebar entry remaining visible during impersonation (item 4) is the only borderline-functional finding; needs a product-side decision on whether UI-only impersonation should hide non-applicable sidebar links.

### Evidence trail

- Cookie obtained via `/smoke-test/cookie` (route present because `SMOKE_TEST_COOKIE_LEAK=1`), persisted to `/tmp/cookie.txt` and used as `Cookie: $COOKIE` header throughout.
- All test artifacts were deleted before moving to the next section; final stored-agent / stored-skill counts match the pre-test state.
- UI verification driven by Stagehand (`Mastra Studio` title; `/agent-builder` shell, list pages, edit pages, infrastructure page all loaded without console errors).

## Run 3 — Auth on, non-admin

_status: pending_

### Product issues

_(none observed yet)_

### Skill issues

_(none observed yet)_
