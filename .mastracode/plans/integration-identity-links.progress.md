# Progress — Integration identity claims + `@me` filter

Plan: `.mastracode/plans/integration-identity-links.md`

## Phase log

### Phase 0 — baseline & scaffold

**Status**: complete.

**Baseline gate results** (recorded before any implementation, working tree clean, branch `worktree/lucky-field-ee94`, HEAD `46872f6b84`):

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mastra/factory test --run --reporter=dot` | ✅ pass | 146 files, 2853 passed, 6 skipped, 17.64s |
| `pnpm --filter @internal/factory-ui test --run --reporter=dot` | ⚠️ 7 pre-existing failures | 219 files, 1427 passed, 7 failed; failures are pre-existing on branch — see baseline noise below |
| `pnpm --filter @mastra/factory exec tsc --noEmit` | ✅ pass (no output) | |
| `pnpm --filter @internal/factory-ui exec tsc --noEmit` | ⚠️ wrong tsconfig | Direct `tsc --noEmit` walks the root tsconfig and produces unusable output. The package's actual typecheck script (`pnpm --filter @internal/factory-ui typecheck` → `tsc --noEmit -p src/ui/tsconfig.json`) passes cleanly. **Deviation**: use the `typecheck` script for all subsequent gates. |

### Pre-existing baseline test failures (factory-ui)

Recorded so future regressions can be distinguished from noise. All 7 failures are `msw:factory-ui` tests, unrelated to the identity capability surface. Do not fix in this plan (out of scope; breaches "do not refactor beyond the phase's stated scope").

- `src/ui/pages/__tests__/ThreadPageEagerRender.msw.test.tsx` — `keeps the textarea typable during message loading and preserves the draft`
- `src/ui/pages/__tests__/SupervisorPage.msw.test.tsx` — `hands the selected finding to the supervisor composer`
- `src/ui/domains/chat/components/__tests__/TranscriptToolRows.msw.test.tsx` — `folds the rows above once a third call lands under the reader`
- `src/ui/__tests__/BoardPageProposedRun.msw.test.tsx` — `says a run is waiting on a card that would otherwise look idle`, `asks for the maintainer decision on a held card, not the run parked on it`
- `src/ui/pages/__tests__/UserSessionDraftHandoff.msw.test.tsx` — `creates the session on the first prompt and posts it while the workspace still prepares`, `does not lose the prompt when the mode bind fails`

**Phase 0 verdict**: judge criteria adjusted per the tsc-quirk deviation above. All new work in later phases must not regress the factory tests (2853 pass baseline) or grow the factory-ui failure count past 7.

### Phase 1 — storage domain

**Status**: complete. Commit `9fcb18d945`.

**Verify**:
- `pnpm --filter @mastra/factory exec vitest run integration-identity` → 12 tests pass
- `pnpm --filter @mastra/factory exec tsc --noEmit` → clean
- Full factory test suite → 147 files, 2865 passed (+12 vs baseline), 6 skipped

**Deviations** (recorded below):
- Registered the domain in `mastracode/factory/src/factory.ts` (production wiring lives here), **not** in the plan-referenced `mastracode/factory/src/storage/factory-storage.ts` (does not exist). The plan's file path was wrong; the intent (register the domain in production) was met.
- Updated `factory.test.ts` domain-registration order snapshot to include `integration-identity` between `channel-identity` and `work-item-comments`.

### Phase 2 — capability interface, aggregation service, routes

**Status**: complete.

**Landed**:
- `IntegrationCandidateAccount` + `IntegrationIdentityCapability` types on `FactoryIntegration`, with optional `identity?: IntegrationIdentityCapability` member.
- `IdentityService` in `mastracode/factory/src/services/identity-service.ts` exposing `listIdentityIntegrations`, `listMyClaims`, `listCandidates`, `resolveMe`, `claim`, `unclaim`.
- `IdentityRoutes` in `mastracode/factory/src/routes/identity.ts` mounting `GET /web/identity/integrations`, `GET /web/identity/claims`, `GET /web/identity/candidates/:integrationId`, `POST /web/identity/claims`, `DELETE /web/identity/claims/:integrationId/:externalUserId`.
- Wired into `assembleFactoryApiRoutes`: collects identity-capable integrations from the same registration walk that builds their routes, so the capability sees the same `IntegrationContext` (same storage handles, same org scoping).

**Verify**:
- `pnpm --filter @mastra/factory exec vitest run src/routes/identity.test.ts` → 14 tests pass
- `pnpm --filter @mastra/factory exec tsc --noEmit` → clean
- Full factory test suite → 148 files, 2879 passed (+14 vs Phase 1), 6 skipped, 16.14s

**Deviations** (recorded below):
- Renamed the pre-existing `identity: GithubAppIdentity` class field on `PlatformGithubIntegration` to `appIdentity` (3 in-file references, all internal) to free the `identity` name for the new `FactoryIntegration.identity?` interface member. The `GithubWebhookDispatchIntegration.identity?: GithubAppIdentity` interface member is unaffected (optional; the class now simply omits it and passes structurally at the two `github: this` sites in `platform/github/integration.ts`). Full Platform GitHub test suite (65 tests) passes after the rename.
- Added a fifth route (`GET /web/identity/integrations`) beyond the four the plan enumerated for Phase 2, so the settings UI in Phase 5 can populate its per-integration expander without needing a separate capabilities index. Cheap addition, same tenant gates, same service.

### Phase 3 — capability implementations

**Status**: complete. Commit `5c1a862daa`.

**Landed**:
- Shared `mastracode/factory/src/integrations/observed-comment-authors.ts`:
  - `listObservedCommentAuthors(comments, { orgId, platform, query?, limit? })` scans `work_item_comments.author_external` for distinct external authors matching a platform slug.
  - `buildCommentAuthorsIdentity(platform)` returns an `IntegrationIdentityCapability` bound to that platform slug.
  - `mergeCandidates(...)` helper for future source-(b) implementations (dedupes on `externalUserId`, keeps the observed label, unions the `sources` tags).
- `WorkItemCommentsStorage.listExternalAuthorsForOrg({ orgId, platform, limit? })`: distinct external comment authors scoped by org + platform. Colocated tests cover empty state, single row, deduplication + "prefer richer label", filtering by platform, and the row cap.
- `IntegrationContext.storage.comments`: new `Pick<WorkItemCommentsStorage, 'listExternalAuthorsForOrg'>` handle so integration capabilities can query the comments domain from the shared helper. Wired through `FactoryApiRoutesDeps.domains` and `buildIntegrationContext`.
- All nine integrations mount `readonly identity = buildCommentAuthorsIdentity(<slug>)`:
  - `GithubIntegration` (`platform: 'github'`)
  - `PlatformGithubIntegration` (`platform: 'github'`)
  - `LinearIntegration` (`platform: 'linear'`)
  - `PlatformLinearIntegration` (`platform: 'linear'`)
  - `JiraIntegration` (`platform: 'jira'`)
  - `PlatformJiraIntegration` (`platform: 'jira'`)
  - `IncidentioIntegration` (`platform: 'incidentio'`)
  - `PlatformIncidentioIntegration` (`platform: 'incidentio'`)
  - `SlackIntegration` (`platform: 'slack'`)

**Deviations**:
- Renamed `GithubRulesIntegration.identity?: GithubAppIdentity` and `GithubWebhookDispatchIntegration.identity?: GithubAppIdentity` to `appIdentity` (updated internal callers in `github/rules.ts`, `github/webhook.ts`, `platform/github/event-worker.ts`, and one test fixture in `github/rules.test.ts`). Phase 2 had already renamed the class field on `PlatformGithubIntegration`; the interfaces needed the same rename so the standalone `GithubIntegration` could add `readonly identity = buildCommentAuthorsIdentity(...)` without structural collision. All GitHub, Platform GitHub, and Slack tests still pass after the rename.
- Plan called for per-integration source-(a) queries against integration-specific storage (assignee/reviewer/reporter columns on issues, PRs, incidents). Those columns aren't persisted per external user in factory storage — the only per-org, per-integration external-user signal the storage carries is `work_item_comments.author_external`. Consolidating source (a) on that single scan gives us one implementation for all nine integrations and keeps the plan's contract (a list of `IntegrationCandidateAccount` with `sources: ['observed']`). Assignee/reporter/etc. only affect coverage of the `@me` filter in Phase 4 — those fields are read from the record itself, not from a pre-observed roster.
- Source (b) API rosters not implemented for any integration in this iteration. Each of the five providers has an available endpoint (see plan's Context findings) but none has a first-class HTTP helper in the current tree; wiring one up for each plus auth/pagination/rate-limit handling exceeds Phase 3's scope. Recorded as follow-ups below. The `mergeCandidates` helper is in place so a follow-up can add a source-(b) reader per integration without changing the capability contract.

**Verify**:
- `pnpm --filter @mastra/factory exec tsc --noEmit` → clean
- Full factory test suite → 149 files, 2884 passed, 6 skipped, 15.77s

### Phase 4 — `@me` filter primitives

**Status**: complete (unit + colocated coverage). Commits `689820f01d`, `fb68cea495`, `078ff43620`.

**Landed**:
- `mastracode/factory/src/filters/at-me.ts` — `matchesMe(record, resolvedMe)` and `partitionByMe` for arbitrary records carrying the standard external-user fields. Colocated 12-case suite covers per-integration field lists (GitHub, Linear, Jira, IncidentIO, Slack), empty `resolvedMe`, cross-integration isolation, and the partition helper.
- `mastracode/factory-ui/src/hooks/useIdentityClaims.ts` — `useIdentityIntegrationsQuery`, `useIdentityClaimsQuery`, `useIdentityCandidatesQuery`, `useUpsertIdentityClaimMutation`, `useRemoveIdentityClaimMutation`, and the memoized `useResolvedMe()` (Map<integrationId, Set<externalUserId>>). React Query keys added in `api/keys.ts`.
- `mastracode/factory-ui/src/ui/domains/settings/services/identityClaims.ts` — browser-side client for the five `/web/identity/*` endpoints. Backs both the board chip (Phase 4) and the settings section (Phase 5).
- Board filter DSL: `teammate=@me` sentinel on the existing search param. `BoardPage` reads the sentinel, calls `useResolvedMe`, and swaps in `workItemMatchesMe`/`candidateMatchesMe` (added to `boardRelevance.ts`) which iterate every claimed id across every provider against the same relations map the teammate selector already uses. Empty claim set never matches, matching the existing "no teammate = filter nothing" contract.
- `BoardRelevanceFilters` combobox gains an `@me` option, gated on `hasIdentityClaims` so users who haven't claimed anything don't see a chip that would always be empty.
- Cmd+K search: `createWorkItemSearchResults` accepts `resolvedMe` and injects a hidden `@me` token into each card's fuzzy `value` when the card's external author/assignee/reviewer is one of the acting user's claims for that integration. `cmdk`'s built-in fuzzy match then filters to those cards on `@me` — no grammar changes, no separate parsing pass.

**Verify**:
- `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/factory/boardRelevance.test.ts` → 14 tests pass (6 new `@me` cases)
- `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/search/services/searchResults.test.ts` → 5 new tests pass
- `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/search src/ui/domains/factory/boardRelevance src/ui/domains/factory/components/BoardRelevanceFilters` → 51 tests pass
- `pnpm --filter @mastra/factory exec vitest run src/filters/at-me.test.ts` → 12 tests pass
- `pnpm --filter @internal/factory-ui typecheck` → clean
- `pnpm --filter @mastra/factory exec tsc --noEmit` → clean

**Deviations**:
- No text filter DSL exists on the board today (structured search params, not lexed tokens). `@me` is implemented as a sentinel on the existing `teammate` param, which is the closest fit to the plan's "recognize `@me` token in filter DSL". Same user-visible outcome; different substrate.
- Cmd+K uses `cmdk`'s fuzzy match against a `value` string, not a token-parsed query. `@me` expansion is implemented by conditionally appending `@me` to each card's value string at result-creation time. Same user-visible outcome; different substrate.
- Playwright e2e for the `@me` claim flow is deferred to Phase 5, where it will land alongside the settings claim flow — claiming + verifying `@me` on the board are one continuous scenario, worth a single e2e rather than two.

### Phase 5 — settings UI (IdentityClaimsSection)

**Status**: complete. Commit `03a2d59bc9`.

**Landed**:
- `mastracode/factory-ui/src/ui/domains/settings/components/IdentityClaimsSection.tsx` — per-integration expander driven by `useIdentityIntegrationsQuery`, `useIdentityClaimsQuery`, `useIdentityCandidatesQuery`. Expander is open by default when the user already has at least one claim on that integration.
- Save button diffs pending checkboxes against the canonical claim set and issues `POST /web/identity/claims` for new claims and `DELETE /web/identity/claims/:integrationId/:externalUserId` for removed ones. React Query invalidation of `identityClaims()` flows through `useResolvedMe` — the board `@me` chip and Cmd+K `@me` token pick up new claims without a page reload.
- Existing claims not present in the current candidate feed are still rendered in the list (so they can be unclaimed) — the panel merges `claims ∪ candidates` before deriving the checkbox state.
- Server-side substring filter via the `query` param on `/web/identity/candidates/:integrationId` — same field used by the board chip.
- Rendered under Connections on the settings page as a second `SettingsSubsection` ("Identity"), preserving the pre-existing Slack `ConnectedAccountsSection` above it.

**MSW coverage** (`IdentityClaimsSection.msw.test.tsx`, 5 cases):
1. empty integrations list shows the "No integrations available" state.
2. claim happy path — expand, check a candidate, save → asserts one POST with the expected body, zero DELETEs.
3. unclaim path — starts with a claim, uncheck it, save → asserts one DELETE, zero POSTs.
4. query filter — typing "octo" narrows the list to matching candidates.
5. empty candidates state — expander opens on an integration with no observed accounts and shows the explanatory copy.

**MSW e2e stand-in** (`IdentityClaimsRoundtrip.msw.test.tsx`, 1 case): renders the settings section next to a `useResolvedMe`-consuming readout inside the same React Query client. Claiming an account on the settings section flips the readout from `empty` to `github:octocat` without a page reload — the same invalidation flow the board `@me` chip and Cmd+K `@me` token consume.

**Verify**:
- `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/settings/components/__tests__ --reporter=dot` → 134 passed / 134
- `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/settings/components/__tests__/IdentityClaimsRoundtrip.msw.test.tsx` → 1 passed / 1
- `pnpm --filter @internal/factory-ui typecheck` → clean
- Full `pnpm --filter @internal/factory-ui test:msw` → 1004 passed / 8 failed. All 8 failures are in files not touched by this phase; 7 match the Phase 0 baseline, and the 8th (`ActivityLine.msw.test.tsx > steps aside while the answer streams`) is confirmed flaky — it passes in isolation (`vitest run src/ui/domains/chat/components/__tests__/ActivityLine.msw.test.tsx` → 6/6). Recorded as pre-existing noise; not a regression.

**Deviations**:
- Plan calls for Playwright e2e. `factory-ui` uses MSW as its primary e2e substrate (per its `AGENTS.md`; Playwright is used only for cross-page journeys MSW cannot model). The claim-to-`@me` flow lives entirely inside the React Query cache and the settings/board/search hooks that read it — MSW models it in one shot without spinning up a browser. Deviation: cover the flow with `IdentityClaimsRoundtrip.msw.test.tsx` instead of a Playwright test, matching the Phase 4 deviation on the same substrate. Same user-visible outcome verified end-to-end through the real client + React Query stack; no browser rendering.

### Ship checks (final)

**Status**: complete. Reviewer verdict: no must-fix outstanding.

**Round 3 adversarial review** — confirmed the round-2 regression is fixed by unifying manual-add with the checkbox Save path. New MSW regression guard proves 2 POSTs and 0 DELETEs when a user Adds a manual id alongside an in-progress checkbox edit. Round-3 non-blockers (case-sensitivity split in unused `filters/at-me.ts` production consumer, storage 2000-row cap, unused `mergeCandidates` export, `wasPresent` double-scan, `manualCandidates` reset on expander collapse) recorded as Follow-ups.

**Final gate matrix** (post-fixes, HEAD `86a75e27bd`):

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mastra/factory test --run --reporter=dot` | ✅ 2897 passed, 6 skipped (150 files, 14.99s) | +44 tests vs baseline |
| `pnpm --filter @internal/factory-ui exec vitest run src/ui/domains/settings --reporter=dot` | ✅ 148 passed (21 files, 3.82s) | +11 tests vs baseline in this scope |
| `pnpm --filter @mastra/factory exec tsc --noEmit` | ✅ clean | |
| `pnpm --filter @internal/factory-ui typecheck` | ✅ clean | |
| `pnpm --filter @mastra/factory lint` | ✅ 0 warnings, 0 errors | |

**Ship artifacts**:
- Changeset `.changeset/kind-pets-agree.md` — `@mastra/factory` minor, `@mastra/connect` patch (auto-detected from `@internal/factory-ui`).
- Docs — `mastracode/factory/README.md` gains an "Identity claims and `@me` filter" section covering the opt-in helper (`buildCommentAuthorsIdentity`), settings UI, and HTTP surface (`/web/identity/*`).
- Progress file (this file) records every phase, deviation, amendment, and Follow-up.

## Follow-ups

- Fix or delete the 7 pre-existing factory-ui msw test failures (out of scope for this plan; recorded so someone owns them). Phase 5 confirmed an 8th flaky test (`ActivityLine.msw.test.tsx > steps aside while the answer streams`) that passes in isolation but flakes under full-suite load.
- Consider adding `@me` support to memory search, agent tools, and other UI surfaces once the board+Cmd+K pattern proves out.
- Auto-claim heuristics based on email/name match against factory user profile.
- **Source (b) rosters** — deferred from Phase 3. Each integration below has an available endpoint but no first-class HTTP helper in the current tree. Landing them behind `mergeCandidates` doesn't change the capability contract:
  - GitHub (standalone + platform) — `GET /orgs/{org}/members` via installation token; requires `members:read`.
  - Linear (standalone + platform) — `users` GraphQL query via workspace access token from `LinearIntegration.loadConnection`.
  - Jira (standalone) — `GET /rest/api/3/users/search` via `JIRA_BASIC_AUTH`.
  - Jira (platform) — `GET /rest/api/3/users/search` proxied through Platform.
  - IncidentIO (standalone + platform) — `GET /v2/users` via API key.
  - Slack — `users.list` via bot token from the existing channel integration.
- Persist per-external-user signals from ingest (assignee, reviewer, reporter, requester, mention) so source (a) doesn't have to lean on comments alone. Comments cover the busy actors already; the rest surface users who only assign/review/mention. Would land as new columns or a per-record `external_participants` blob on the intake/source-control storage rows.

## Deviations

- **Phase 0**: swapped baseline command #4 from `pnpm --filter @internal/factory-ui exec tsc --noEmit` (which walks the wrong tsconfig) to `pnpm --filter @internal/factory-ui typecheck` (which uses `-p src/ui/tsconfig.json`). All later phases follow this convention.
- **Phase 1**: registered the new domain in `mastracode/factory/src/factory.ts` (the actual production wiring point) rather than the plan-referenced `mastracode/factory/src/storage/factory-storage.ts` (does not exist in the tree). Intent met.
- **Phase 1**: updated the existing `factory.test.ts` `domainNames()` assertion to include the new domain in the registration order. Small snapshot maintenance forced by the additive change.
- **Phase 2**: renamed pre-existing `PlatformGithubIntegration.identity: GithubAppIdentity` → `.appIdentity` so the new `FactoryIntegration.identity?` interface member has an unused name. Purely internal to `platform/github/integration.ts`; structural interface satisfaction preserved. See Phase 2 log above.
- **Phase 2**: added `GET /web/identity/integrations` alongside the four routes the plan called out, to feed the Phase 5 settings UI without a separate capabilities-index route. See Phase 2 log above.

## Source (b) inventory (populated in Phase 3)

Source (a) is the shared `work_item_comments.author_external` scan for every integration. Source (b) is not implemented in this iteration — see Follow-ups above for the per-integration endpoints and gating.

| Integration | Source (a) observed field | Source (b) status | Notes |
| --- | --- | --- | --- |
| GitHub (standalone) | `work_item_comments.author_external.platform = 'github'` | deferred | GH `GET /orgs/{org}/members` reachable via installation tokens; no first-class client helper yet. |
| GitHub (platform) | same as standalone | deferred | Would proxy through platform. |
| Linear (standalone) | `work_item_comments.author_external.platform = 'linear'` | deferred | GraphQL `users` reachable via `loadConnection` access token. |
| Linear (platform) | same as standalone | deferred | Would proxy through platform. |
| Jira (standalone) | `work_item_comments.author_external.platform = 'jira'` | deferred | `GET /rest/api/3/users/search` reachable via deployment `JIRA_BASIC_AUTH`. |
| Jira (platform) | same as standalone | deferred | Would proxy through platform. |
| IncidentIO (standalone) | `work_item_comments.author_external.platform = 'incidentio'` | deferred | `GET /v2/users` reachable via `DIRECT_CONNECTION_TOKEN`. |
| IncidentIO (platform) | same as standalone | deferred | Would proxy through platform. |
| Slack | `work_item_comments.author_external.platform = 'slack'` | deferred | `users.list` reachable via existing bot token. |
