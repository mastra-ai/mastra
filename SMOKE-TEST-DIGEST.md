# Builder Smoke Test — Consolidated Digest

> Summary of all Run 1 (auth-off) findings across passes 1–3, plus historical archive (2026-05-11). Source archives deleted after this digest was written. Use this as the cross-check reference when reviewing Run 2 / Run 3 results.

## Status as of 2026-05-12 17:00

- **Auth-off path:** validated three times. Stable. No remaining product bugs.
- **Auth-on (admin):** not yet executed in current branch state. Move to Prompt 2 next.
- **Auth-on (non-admin):** not yet executed. Move to Prompt 3 after Prompt 2.

## Fixed and shipped on PR #16447

| #   | Bug                                                                                        | Fix location                                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Skills partial-PATCH 500 (NOT NULL on description/instructions)                            | `packages/server/src/server/handlers/stored-skills.ts` — strip undefined from snapshot before `update()`                  |
| 2   | Skill publish 500 ENOENT on missing source dir                                             | `stored-skills.ts` — `fs.stat` preflight returns structured 400                                                           |
| 3   | Library Copy null-handling                                                                 | `packages/playground/src/.../use-copy-skill.ts` — strip null `license`/`files` before POST                                |
| 4   | Infrastructure UI Registries card missing                                                  | infrastructure page now renders Browser → Registries → Workspace                                                          |
| 5   | `POST /stored/agents` rejected requests without `model`                                    | `createStoredAgentBodySchema` overrides `model` to optional; handler calls `applyBuilderDefaults`                         |
| 6   | Publish handler response had `files: null`                                                 | `publish.ts` — `buildSkillFileNodes` converts walked files into `StorageSkillFileNode[]`                                  |
| 7   | Publish `undefined`-field 500 across all storage adapters                                  | handler + editor namespace + libsql/pg/inmemory/filesystem all strip undefined from `configFields`                        |
| 8   | Bare `/agent-builder/skills/:id` and `/agent-builder/agents/:id` returned React Router 404 | `App.tsx` adds loader redirects to canonical `/edit` (skills) and `/view` (agents)                                        |
| 9   | Star button silent 401 under auth-off                                                      | `star-button.tsx` + `skill-star-button.tsx` disable button with "Sign in to star" tooltip when auth enabled but no caller |

## Resolved as non-issues after investigation

| Finding                                                | Why it's not a bug                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Pass-1 Bug 4 (create-skill UI Public not persisting)   | Obsolete — new chat-first flow (`skill-builder-starter.tsx`) has no visibility selector. Visibility is set on the edit page only. |
| Pass-1 P3 (`builder-workspace.status = "draft"`)       | Workspaces don't auto-publish; only agents do. Consistent with skills pattern.                                                    |
| Pass-1 P4 (`visibleAgents` includes `builder-agent`)   | Not reproducible against current scaffold. `resolvePickerVisibility` correctly excludes `builder-agent` from response.            |
| Pass-2 P1 (workspace `metadata` field omitted)         | `storedWorkspaceSchema.metadata` is `optional` and persists when provided. Skill docs were over-strict.                           |
| Pass-2 P5 (empty-state full-page redirect)             | Empty `/agent-builder` redirects to in-shell `/agent-builder/agents/create`, not Studio's standalone route.                       |
| Pass-3 P3 (`featuresAgent` shape divergence)           | Skill verification commands were stale. Canonical shape is `features.agent.skills` + `configuration.picker.{...}.allowed`.        |
| Pass-3 P4 (picker allowlist kebab vs camel mismatch)   | Server resolves both `entity.id` form and registration-key form via `collectAliases`. Both inputs work; output is canonical key.  |
| Pass-3 P7 (default model `gpt-5.4` is fictional)       | Confirmed real — released March 2026. Scaffold ships correct model IDs.                                                           |
| Pass-3 P9 (agent view back-arrow missing `aria-label`) | Button component auto-applies `aria-label` from the `tooltip="Skills list"` / `tooltip="Agents list"` prop on icon-only buttons.  |
| Pass-3 P10 (publish empty-body error not structured)   | Zod errors already pass through `formatZodError` returning `{error, issues: [{field, message}]}`.                                 |

## Deferred — design decisions, not bugs

These were flagged across passes but are intentional behavior or feature requests, not defects:

- **Skill edit page dirty/saved indicator** — real UX feature, owner decision.
- **`browser.config` / `workspace.config` returning `[]`** — empty-array contract for "no entries". Documented.
- **PATCH workspace response omits `filesystem`** — returning only changed fields. Intentional, debatable.
- **`visibility: "private"` coerced to `"public"` under auth-off** — intentional fallback; no callerId to scope private visibility.
- **"My agents" filter hides orphan `authorId: null` rows** — intentional ownership scoping.
- **Server log noise** ("Stored workspace not found", "Error calling handler") — emitted by Hono and stale-tab requests. Out of scope.
- **`POST /stored/agents` with `memory: null` returns 400** — `null` is only an opt-out on update, not create. Documented in `defaults.md`.

## Re-verify in Prompt 2 (auth on, admin)

These items were flagged in the 2026-05-11 archive but are pre-merge state and should be checked again on the current branch:

- Visibility badges on skill list consistency (Run 6 #7)
- `workspaceId: null` on stored skill (Run 6 #9)
- Library Copy end-to-end against a non-owner skill
- `authorId` persistence under WorkOS session
- Role preview UI gating (admin vs viewer)
- Visibility persistence on create — the chat-first flow uses `useDefaultVisibility()` which should yield `private` under auth-on

## Prompt 2 readiness checklist

- [x] All Prompt 1 product bugs fixed and pushed
- [x] All Prompt 1 skill drift patched
- [x] Skill is neutral (no pre-decided bugs)
- [x] Scaffold supports `BUILDER_SMOKE_TEST_DIR` / `--dir` and asks user at start
- [x] Auth-off star UX surfaces failure state
- [x] Bare `/agent-builder/skills/:id` and `/agents/:id` no longer 404
- [ ] `~/.mastra-env` has `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID` (user appended earlier)
- [ ] SMOKE-TEST-RESULTS.md reset to clean 3-run template
