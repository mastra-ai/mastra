# Builder Smoke Test Results

> Log product issues and skill issues as separate lists. Do not pre-decide bugs — record what you observed.

## Run 1 — Auth off

_status: pending_

### Product issues

_(none observed yet)_

### Skill issues

_(none observed yet)_

## Run 2 — Auth on, admin

_status: complete — 2026-05-12_

**Scope:** end-to-end smoke test against `/Users/naiyer/Documents/Projects/mastra-org/testing/builder-smoke` (scaffolded by the skill, linked to this worktree).
**Auth:** `AUTH_PROVIDER=workos`, WorkOS Google SSO, signed in as `nik@mastra.ai` (id `user_01KPS2202RYQR4JAMPVXBB9A1H`, roles `["admin"]`, permissions `["*"]`).
**Sections run:** Workspace, Reconciliation (1+5), Defaults, Model Policy, Skills, Registry, Agents, Pickers, Stars, Permissions/RBAC, Infrastructure, Channels, UI (Core 1–8 + role impersonation), Auth.
**Result:** All sections passed the section-level checklist. Several product drifts and one minor skill-doc drift observed (recorded below).

### Product issues

1. **`PATCH /stored/workspaces/:id` drops the `filesystem` field on persisted record.** A PATCH that does not include `filesystem` causes the field to be removed from the workspace document on disk, not just from the response. Confirmed by re-`GET` after PATCH. Looks like persistence layer is `set`-ing the request body instead of merging.

2. **Builder workspace `runtimeRegistered` is missing from `GET /stored/workspaces/builder-workspace`.** Reconciliation step 1 reference doc expects `runtimeRegistered: true` on the builder workspace, but the response omits the field entirely. The infra endpoint (`/editor/builder/infrastructure → workspace.registered`) returns `true`, so the runtime registry is healthy — it's the `/stored/workspaces` GET projection that doesn't surface it.

3. **`metadata.source` differs between endpoints for the builder workspace.** `/stored/workspaces/builder-workspace` reports `metadata.source: "builder"`, but `/editor/builder/infrastructure → workspace.source` reports `"mastra"`. One of the two is computing the source label inconsistently.

4. **Skill `visibility: private → public` on a never-published skill does not auto-publish.** Reference doc + product expectation: flipping visibility to public on a draft skill should auto-publish it. Observed: PATCH returns 200, `visibility` flips to `public`, but `status` stays `draft` and `activeVersionId` stays `null`. No publish side effect.

5. **Admin role bypasses `*:delete` gating.** Per `packages/core/src/auth/ee/defaults/roles.ts`, the `admin` role does not grant `*:delete`. With auth on, `/auth/me` reports `roles: ["admin"]` **and** `permissions: ["*"]`. That `*` wildcard comes from `@mastra/auth-workos` role mapping, not the core defaults — so DELETE succeeds for admin. Whether this is "by design for WorkOS admins" or "auth-workos role mapping should mirror core defaults" needs a product decision; flagging it because the matrix in the reference doc says admin should not be able to delete.

6. **`/agent-builder/skills/create` is reachable under Viewer role impersonation.** UI-layer gap: while impersonating Viewer, the create-page starter renders (chat composer, example prompts). The backend would still reject a POST, but the route should not render at all for Viewer. Member impersonation gates `+ New agent` correctly on the agents list, so the gating exists in some places but not the skills create route.

7. **Role impersonation picker exposes only Member and Viewer, not an explicit Admin item.** Reference doc expects an explicit admin/member/viewer toggle. Observed: dropdown shows `Member`, `Viewer`, `Settings`, `Sign out`. Admin is implicit when no role is selected; exiting via the impersonation banner's "Exit role preview" restores admin. Minor UX drift.

8. **Stored agent route is `/view` while stored skill route is `/edit`.** `/agent-builder/agents/:id/view` vs `/agent-builder/skills/:id/edit`. Functionally fine (agents land on the chat-driven view page, skills land on the split edit pane), but the asymmetric URL conventions are surprising for anyone deep-linking.

9. **`POST /agents/:id/generate` returns 500 when observational memory is enabled but no `threadId` is provided.** Hit during RBAC step 4 while exercising admin execute. RBAC succeeded (it's a 500, not a 403), but the 500 itself is a product issue: observational memory should either be optional, auto-create a thread, or return 400 with a clear message instead of 500.

10. **WorkOS auto-generated cookie password regenerates on every dev-server restart, invalidating active sessions.** Each `mastra dev` restart logs `[WorkOS] Using auto-generated cookie password for development` and produces a fresh random key, so every previously-issued session cookie becomes invalid. Painful for any flow that restarts the server mid-test (reconciliation step 5, auth toggling). A stable dev-mode fallback (e.g., derived from project path or `.env`) would let testers reuse cookies across restarts.

### Skill issues

1. **`wait-for-server.sh` arg order is `[budget] [port]`, but the original kick-off comment in this run used `wait-for-server.sh http://localhost:4111 30`.** Easy to misread because the reference doc snippets don't always make the order explicit. Suggest renaming the script's positional args or accepting `--port`/`--budget` flags.

2. **`preflight.sh` requires `OPENAI_API_KEY` to be exported in the current shell even when the scaffolded project already has it in `.env`.** Sourcing `~/.mastra-env` in a sub-step doesn't propagate cleanly across shells, and the script will re-scaffold rather than reuse an existing project. Mid-run preflight (e.g., for the auth section's auth-off step 3) isn't workable; we verified auth-off behavior manually instead. Consider a `--skip-scaffold` mode or a no-op mode that just checks the running server's auth posture.

3. **Reference docs for reconciliation step 1 expect `runtimeRegistered: true` on the stored builder workspace.** As noted in product issue #2, that field is absent. Either the doc or the API needs to align.

4. **Registry section steps 9–13 ("Library Copy" flow) require a second user's public skill and aren't runnable in a single-account auth-on run.** The reference doc doesn't surface that constraint up front. Suggest annotating "needs multi-user setup" so testers know to skip those steps without flagging them as failures.

5. **End-of-run cleanup mandates per-entity DELETE calls in a hermetic scaffold dir.** `SKILL.md` (Cleanup section, step 1) says "Delete every smoke-test entity you created (workspaces, agents, skills). Use the per-section cleanup snippet from the matching reference file or `--clean`." But the scaffold is a self-contained directory at `/Users/naiyer/Documents/Projects/mastra-org/testing/builder-smoke` — the entire fixture state lives on disk under that project and gets re-created from scratch by `preflight.sh` on the next run. Deleting entities one-by-one via authed API calls is:
   - **High friction with auth on:** the WorkOS session expires every server restart (see product issue #10), so cleanup often needs a fresh sign-in just to issue DELETEs that throw away the data anyway.
   - **Redundant:** `rm -rf` of the scaffold dir (or `preflight.sh --reset` / re-scaffold) achieves the same end state in one step with zero auth gymnastics.
   - **Misleading:** when cleanup fails (because of expired auth), the run _looks_ incomplete even though the data is genuinely disposable.

   Suggest changing the cleanup contract to: "If you toggled `.env`, restore it. Then either (a) leave the scaffold dir for re-use, or (b) `rm -rf` the scaffold dir if you want a clean slate." Per-entity DELETE should be reserved for sections that explicitly need to verify DELETE behavior (which they already do inline). The dev server should still be killed cleanly at the end.

## Run 3 — Auth on, non-admin

_status: pending_

### Product issues

_(none observed yet)_

### Skill issues

_(none observed yet)_
