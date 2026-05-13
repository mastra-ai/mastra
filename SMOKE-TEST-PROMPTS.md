# Builder Smoke Test — Prompts

> **Internal test harness for verifying the `builder-smoke-test` skill itself.** Not part of the user-facing skill. In normal use, just trigger the skill directly.

## How to use

For each prompt below:

1. Pick a project directory. The skill defaults to `~/mastra-builder-smoke-tests/builder-smoke`, but accepts a custom path via the `BUILDER_SMOKE_TEST_DIR` env var or the scaffold's `--dir` flag. The skill will ask you up-front in normal use; for these prompts, set `BUILDER_SMOKE_TEST_DIR` in your shell or pass `--dir` so all scripts agree.
2. Either delete the project directory for a cold start, or let the scaffold script overwrite it idempotently. The skill's `scripts/scaffold.sh` writes `package.json`, `tsconfig.json`, `src/mastra/`, `.env`, and runs `pnpm install --ignore-workspace`. The agent runs scaffold itself as part of the run — you don't need to pre-scaffold.
3. For auth-on prompts, make sure the WorkOS keys (`OPENAI_API_KEY`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID`) are available in your shell env (e.g. via `~/.mastra-env` or your rc file). The agent's preflight will auto-fill `--workos-*` from the env. If missing, the agent will ask which rc file to source.
4. Paste the prompt below into a fresh chat with the `builder-smoke-test` skill loaded.
5. After the run finishes, the agent fills in its report under the appropriate `## Run N` heading in `SMOKE-TEST-RESULTS.md`. The file already has placeholders for all 3 runs; the agent should only edit the section matching its run number.

## Logging conventions (applies to every prompt)

Each prompt asks the agent to log two distinct things under separate subsections in its report:

- **Product issues** — the server, UI, or feature behaved unexpectedly (wrong status code, missing field, broken UI flow, etc.). Log: HTTP method + path (or UI route), expected vs actual, one-sentence guess at the cause. Do **not** pre-decide that something is "a known bug" — log what the server actually did.
- **Skill issues** — the skill itself was wrong, unclear, or out-of-date. Log: which file (e.g. `references/skills.md` step F2) and what was wrong (stale path, missing step, unreachable assertion, confusing wording, contradicted by actual server behavior). These are doc-drift problems we patch in the skill, not product bugs.

Both lists are useful even when empty — say so explicitly.

**Before filing any item, verify on a fresh response in the current run** — do not cite a field name from memory of an earlier call. For any shape-mismatch claim (wrong key, missing field, "API returns X instead of Y"), paste the actual JSON keys you observed directly under the bullet, alongside what the skill claims. Field names that look similar at a glance (`featSkills` vs `features.agent.skills`, `visibility` vs `defaultVisibility`) are easy to misread. If the claim can't be reproduced on a fresh request, drop it.

## Prompt 1 — Full run, auth off

**Env setup (auth off):** the scaffold writes a default `.env` with `AUTH_PROVIDER` commented out, which is what you want for this run. If `.env` already has `AUTH_PROVIDER=workos` set from a previous run, comment it out and restart the dev server.

```
Run the builder-smoke-test skill end-to-end with --expect off --auth off.

Walk every section (Setup, Workspace, Reconciliation steps 1+5 only, Defaults, Model Policy, Skills, Registry, Agents, Pickers, Stars, Permissions/RBAC, Infrastructure, Channels, UI, Auth). Do NOT skip sections because they "seem complex" or "won't apply." Try every step. If a step is genuinely impossible under auth off (e.g. Stars requires auth on), mark it ⏭️ with one line of reason — that's allowed.

Maintain two separate lists in your report:

1. "Product issues" — surprising server/UI responses. Log HTTP method + path, expected vs actual, one-sentence guess at the cause.
2. "Skill issues" — anything in the skill itself that was wrong, unclear, stale, or unreachable. Log the file + step and what was wrong (e.g. "references/skills.md step F2 says X but server returned Y", "preflight.sh didn't catch missing env var", "step assumes UI control that no longer exists"). Even small wording problems count.

Do not pre-decide that something is "a known bug" — log what actually happened.

Verify before filing: for any shape-mismatch claim (wrong key, missing field, "API returns X instead of Y"), paste the actual JSON keys you observed directly under the bullet, alongside what the skill claims. If the claim can't be reproduced on a fresh request, drop it.

At the end, write your report into the "## Run 1 — Auth off" section of /Users/naiyer/.superset/worktrees/mastra/yj/magnificent-marquess/SMOKE-TEST-RESULTS.md. The file already has placeholders for all 3 runs — only edit your section, leave the others untouched.
```

## Prompt 2 — Full run, auth on, admin

**Env setup (auth on, admin):** in your project's `.env`, set `AUTH_PROVIDER=workos` and confirm `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ORGANIZATION_ID`, `WORKOS_REDIRECT_URI` are set (the scaffold fills these in if you pass `--workos-*` flags or have them in env). Make sure your WorkOS user has the `admin` (or `owner`) role on the configured org. Restart the dev server. Log in once in the browser so a session cookie exists.

```
Run the builder-smoke-test skill end-to-end with --expect on --auth on --role admin.

Before any other section, call GET /api/auth/me with the session cookie and confirm "roles" contains "admin" (or "owner"). If it doesn't, stop and tell me the actual roles — don't continue with mismatched expectations.

Walk every section. Use the role expectation matrix in references/permissions.md to set per-step expected status codes for the Permissions/RBAC section. Run the role-impersonation UI subset in references/ui.md step 15 (admin-only, frontend-only feature — confirm UI behavior but do NOT expect API responses to change while impersonating).

Maintain two separate lists in your report:

1. "Product issues" — surprising server/UI responses (method/path, expected vs actual, one-sentence guess).
2. "Skill issues" — file + step + what was wrong in the skill itself (stale path, missing step, unreachable assertion, contradicted by actual behavior, etc.).

Verify before filing: for any shape-mismatch claim, paste the actual JSON keys you observed alongside what the skill claims. If you can't reproduce on a fresh request, drop it.

**Writing the report — read carefully:** Do NOT overwrite SMOKE-TEST-RESULTS.md. The file already has all 3 run sections. Only edit the "## Run 2 — Auth on, admin" section. Leave Run 1 and Run 3 untouched. Verify after writing by grepping for "## Run 1" and "## Run 3" — both must still be present.
```

## Prompt 3 — Full run, auth on, non-admin

**Env setup (auth on, non-admin):** same as Prompt 2, but change your WorkOS user's role on the org to `viewer` (or `member`) in the WorkOS dashboard, restart the dev server, and re-log-in. Confirm via `curl /api/auth/me` before launching the prompt.

```
Run the builder-smoke-test skill end-to-end with --expect on --auth on --role viewer (or --role member, whichever the live user actually has).

Confirm /api/auth/me roles match --role before continuing. If not, stop.

Walk every section. The Permissions/RBAC section is the headline here: every write endpoint should 403 under viewer, and execute should 403 too (viewer has only :read). Member can execute but not write. Use the matrix in references/permissions.md. Skip the role-impersonation UI subset (admin/owner only). Skip any test step that requires admin perms to set up fixtures, marking ⏭️ with one line of reason.

Maintain two separate lists in your report:

1. "Product issues" — surprising server/UI responses (method/path, expected vs actual, one-sentence guess).
2. "Skill issues" — file + step + what was wrong in the skill itself.

Verify before filing: paste actual JSON keys for any shape-mismatch claim, drop anything you can't reproduce on a fresh request.

**Writing the report — read carefully:** Do NOT overwrite SMOKE-TEST-RESULTS.md. The file already has all 3 run sections. Only edit the "## Run 3 — Auth on, non-admin" section. Leave Run 1 and Run 2 untouched. Verify after writing by grepping for "## Run 1" and "## Run 2" — both must still be present.
```

## After all 3 runs

Triage SMOKE-TEST-RESULTS.md:

- Group "Product issues" into A (verified product bug), D (open product question), E (not reproducible / refuted).
- Group "Skill issues" into B (already fixed elsewhere), C (drift to patch).
- File bucket-A items as comments on Linear COR-895.
- Patch bucket-C items in `references/*.md` and push.
- Park bucket-D for product discussion.
