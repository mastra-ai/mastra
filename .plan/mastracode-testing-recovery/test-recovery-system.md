# Mastra Code test recovery system

This document captures the proposed system for moving from feature mapping to high-confidence test coverage.

## Core quality bar

For every mapped feature, define the full set of user-facing and system-facing invariants that must remain true, then add enough tests across the right layers that breaking any invariant is very likely to fail CI.

Not one happy path. Not only the important stuff. The goal is a regression shield for everything we want to never break.

## TUI coverage rule

If a behavior is visible in, triggered from, or affected by the TUI, it gets TUI e2e coverage.

This is not optional and not merely representative. If users can see or interact with a behavior in Mastra Code, the TUI contract should be locked by an e2e test.

E2E tests should become cheap enough to use broadly by investing in:

- AIMock-driven deterministic model behavior.
- A solid Mastra Code TUI test utility.
- A dedicated testing skill that documents the patterns, fixtures, and verification expectations.

## Contract extraction

Each feature card should be converted into a behavior contract list before implementation begins.

For each feature, extract:

1. User contracts
   - What the user can do.
   - What they should see.
   - What must persist across restart, thread switch, mode switch, and config changes.

2. State contracts
   - Who owns the state.
   - When state is created, updated, persisted, restored, and cleared.
   - What must not leak across threads, resources, config dirs, or sessions.

3. Boundary contracts
   - CLI args, env, settings, auth, storage, network, filesystem, browser, git, gh, and tool-call boundaries.
   - How failures are surfaced, suppressed, retried, or persisted.
   - How old data and migrations behave.

4. Interaction contracts
   - How the feature composes with related features.
   - Example: model selection + thread switching + status line + prompt context.

5. Regression history contracts
   - Every historical bugfix/change in the feature card becomes a candidate invariant.
   - If a PR fixed something, ask: what test would have caught this before merge?

## Contract categories

Classify each invariant so the required test layer is obvious.

1. TUI-visible
   - Must have TUI e2e coverage.
   - Examples: status line, dialogs, command overlays, streamed messages, task list, notifications, ask_user, model selector.

2. TUI-triggered
   - Must have TUI e2e coverage for the command/user flow.
   - Usually also needs integration or unit tests for internals.
   - Examples: `/threads`, `/models`, `/github subscribe`, `/api-keys`, `/mode`.

3. Runtime/internal
   - Needs integration or unit coverage.
   - TUI e2e is required only when it has visible consequences.
   - Examples: provider registry fallback, storage migrations, signal dedupe, schema compatibility.

4. External/system boundary
   - Needs mocked integration or smoke coverage.
   - Examples: git, gh, auth callbacks, MCP, browser, filesystem.

## Test layers

Use the lowest reliable layer for each invariant, but do not skip TUI e2e for TUI-visible or TUI-triggered contracts.

- Unit tests: pure logic, parsing, formatting, reducers, config resolution, rendering helpers, permission decisions.
- Integration tests: Harness/session/storage/tool/signal/memory composition without a full terminal UI.
- TUI e2e tests: actual user-visible terminal workflows using AIMock and the TUI test utility.
- Smoke tests: packaged CLI or generated-project checks for the few paths that need binary-level proof.

## Commit and proof flow

Implementation work happens on this branch. Keep work reviewable by grouping commits by coherent feature area, or by individual test group when the test is large enough to review independently.

For each grouped feature area or large test group:

1. Add the tests first.
2. Prove the tests are meaningful before fixing any revealed product issue.
3. Intentionally break the target Mastra Code feature in realistic ways and confirm the new tests go red.
4. Revert the intentional breaks before committing.
5. Only after the tests are proven solid should product fixes be added.
6. Commit a clean grouped chunk on this branch after verification passes.

For every new test or test group, run at least three realistic break validations when practical. These should be feature-relevant edits where Mastra Code still runs but the tested contract fails. Do not use blunt invalidations such as deleting files, forcing `process.exit()`, throwing at startup, or otherwise making the app trivially broken.

Record the proof in the feature card or linked test-recovery notes:

- New tests added.
- Contracts/invariants covered.
- Realistic break #1 and failing test evidence.
- Realistic break #2 and failing test evidence.
- Realistic break #3 and failing test evidence.
- Final verification after reverting the intentional breaks and applying any real fixes.

## Work loop

For each feature or small feature cluster:

1. Read the feature card and related cards.
2. Extract the behavior contract list.
3. Classify each invariant by required test layer.
4. Identify existing tests that already cover each invariant.
5. Add missing tests until each invariant is covered or explicitly deferred with rationale.
6. Add the tests first.
7. Prove the tests by making realistic feature-level breaks and confirming the tests fail.
8. Revert the intentional breaks.
9. Fix any real product issues revealed by the tests, after the tests are proven correct.
10. Run focused verification first, then broader Mastra Code tests when appropriate.
11. Update the feature card and tracker with coverage and break-validation evidence.
12. Commit one coherent, reviewable chunk on this branch.

## Slash command and goal flow

The test recovery flow should be driven by a dedicated project slash command with `goal: true` metadata, similar to the feature-map audit command.

The command should carry the detailed goal text and own the full unfinished queue. It should not rely on each agent inventing a new goal shape, and it should not accept or request a feature argument.

The command should instruct the agent to:

1. Pick the next unfinished feature from the test recovery tracker.
2. Read the feature card and related cards.
3. Extract or update the feature's behavior contract list.
4. Classify each invariant by required test layer.
5. Identify existing tests that already cover each invariant.
6. Add missing unit, integration, TUI e2e, and smoke tests until the feature's contracts are covered or explicitly deferred with rationale.
7. Run the narrowest relevant verification commands, then broader Mastra Code checks when appropriate.
8. Update the feature card and test recovery tracker with evidence.
9. Commit one coherent, reviewable chunk on this branch.
10. Push after committing so progress is recoverable remotely.
11. Continue to the next unfinished feature unless blocked; verification gates and grouped commits provide review boundaries for the goal judge.
12. After the full queue is exhausted or all remaining rows are explicitly deferred, ask the user for final approval before considering the overall goal done.

## Progress tracking

The system needs a tracker separate from the original PR queue. It should record feature-level test recovery state after goal-judge validation.

Possible tracker:

```text
.plan/mastracode-testing-recovery/test-recovery-tracker.md
```

Each row should include:

- Feature card path.
- Risk level.
- Current coverage state.
- Required contract categories.
- Commit(s) for grouped work on this branch.
- Verification commands/evidence.
- Goal-judge status: pending, in-progress, validated, needs-follow-up, deferred.

The slash command should use this tracker to advance through the full unfinished queue. A feature is not considered finished just because tests were added; it is finished only after the feature card, tracker, and verification evidence are updated and the goal judge can validate the result.

## Harness, skill, and command status

The discovery/pilot phase is complete enough to start broad test recovery:

- TUI e2e uses `@microsoft/tui-test` through the checked-in static wrapper at `mastracode/scripts/mc-e2e/tui.test.ts`.
- Scenarios live under `mastracode/scripts/mc-e2e/scenarios/` and are registered in `scenarios/index.ts`.
- AIMock fixtures live under `mastracode/scripts/mc-e2e/fixtures/` and provide deterministic LLM responses.
- Runtime isolation uses per-scenario temp dirs, isolated app data via `MASTRA_APP_DATA_DIR`, isolated DB paths, seeded settings/auth, and provider env sanitization.
- Live observe mode is available through `pnpm --filter ./mastracode run e2e:observe <scenario>`.
- Headless verification is available through `pnpm --filter ./mastracode run e2e:test` and supports `--jobs <n>`.
- The dedicated testing skill is `.claude/skills/testing-mastracode-tui/SKILL.md`.
- The autonomous recovery command is `.mastracode/commands/recover-mc-tests.md` and should be run with `/goal/recover-mc-tests`.

Remaining setup before the first broad goal run:

1. Initialize `.plan/mastracode-testing-recovery/test-recovery-tracker.md` from the feature-map index.
2. Start with the highest-risk unfinished feature rows.
3. Let the command continue through unfinished rows, committing grouped feature-area/test-group chunks on this branch.
