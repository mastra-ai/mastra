---
name: recover-mc-tests
description: Autonomously add and verify Mastra Code regression-shield tests for every unfinished mapped feature.
goal: true
---

# Goal: Recover Mastra Code test coverage

Add reliable regression-shield test coverage for every unfinished mapped Mastra Code feature.

This command always works the full unfinished queue. Do not request feature selection. Ask the user only if the tracker or feature map is too inconsistent to proceed safely.

## Operating protocol

1. Activate and follow the `mastracode-testing-recovery` skill.
2. For TUI/e2e scenario work, activate and follow the `testing-mastracode-tui` skill.
3. Read, in order:
   - `mastracode/AGENTS.md`
   - `.plan/mastracode-testing-recovery/README.md`
   - `.plan/mastracode-testing-recovery/test-recovery-system.md`
   - `.plan/mastracode-testing-recovery/features/README.md`
   - `.plan/mastracode-testing-recovery/test-recovery-tracker.md`
   - `.plan/mastracode-testing-recovery/handoff.md`
4. Run `git status --short --branch`.
5. Work on the current branch. Do not create feature branches or worktrees for this goal.
6. Treat all existing docs and handoffs as leads, not truth. Verify against source, tests, and command output.

## Tracker initialization and queue selection

Use `.plan/mastracode-testing-recovery/test-recovery-tracker.md` as the progress source of truth.

If the tracker is missing or incomplete:

1. Build/update it from the table in `.plan/mastracode-testing-recovery/features/README.md`.
2. Include every feature page whose test status is `Missing` or `Partial`, plus any `High` risk page unless it is already validated.
3. Preserve existing tracker rows and evidence.
4. Add new rows with status `pending`.

Then select the next unfinished row using this priority:

1. `in-progress` rows first.
2. `High` risk before `Medium`, then `Low`.
3. `Missing` coverage before `Partial` coverage.
4. TUI-visible or TUI-triggered features before purely internal features.
5. Feature-map order as the final tie-breaker.

Unfinished statuses are: `pending`, `in-progress`, `needs-follow-up`, `blocked`, and `deferred-needs-review`.
Finished status is only `validated`.

Continue until every tracker row is `validated` or explicitly deferred with rationale that the goal judge can review. A TUI-visible, TUI-triggered, or terminal-user-observable row is not `validated` until its TUI e2e status is covered or explicitly deferred.

## Per-feature work loop

For each selected feature or tightly related feature cluster:

### Gate 1 — contract extraction

1. Mark the tracker row `in-progress`.
2. Read the feature card and related feature cards.
3. Read current source and existing tests for the feature.
4. Extract a behavior contract list covering:
   - User-visible behavior.
   - TUI-visible and TUI-triggered flows.
   - Headless/non-TUI behavior.
   - Streaming, loading, interruption, reload, and loaded-from-history behavior.
   - State creation, ownership, persistence, restoration, cleanup, and cross-thread/resource isolation.
   - External boundaries: env, settings, auth, storage, git, gh, filesystem, MCP, browser, network, tools.
   - Historical regression risks listed in the feature card.
5. Classify each contract by required test layer:
   - Unit.
   - Integration.
   - TUI e2e.
   - Smoke/manual-only deferred with rationale.
6. Identify existing tests and map them to contracts.
7. Update the feature card and tracker with the contract/test-gap summary before writing new tests when the gap is non-trivial.

### Gate 2 — add missing tests

1. Add missing tests at the lowest reliable layer for implementation contracts.
2. If behavior is visible in, triggered from, or affected by the TUI, checked-in TUI e2e coverage under `mastracode/scripts/mc-e2e/scenarios/` is required before the row can be marked `validated`. Unit, integration, component, command, or headless tests are supporting shields; they do not satisfy this gate by themselves.
3. For LLM behavior, use deterministic AIMock fixtures. Do not rely on local provider credentials.
4. If realistic fixture data is needed, read it from the local Mastra Code database under the user's Application Support directory only with explicit read-only operations, sanitize it, and transform it into AIMock-compatible fixture files. Never point CI or committed tests at the live local database.
5. Keep tests product-realistic. Avoid tests that only assert implementation details unless the feature itself is an implementation boundary.
6. If a test reveals a real product bug, first prove the test is correct, then fix the product bug.

### Gate 3 — prove tests are meaningful

For each new test group, perform realistic break validation when practical:

1. Make a small plausible feature-level break that leaves Mastra Code runnable.
2. Run the new focused test and confirm it fails for the intended reason.
3. Revert the intentional break.
4. Repeat for at least three distinct breaks when practical.

Do not use trivial breaks like deleting files, throwing at startup, forcing exits, or corrupting the test itself.

Record break-validation evidence in the tracker or feature card:

- Break description.
- Command run.
- Expected failing test or assertion.
- Confirmation that the break was reverted.

### Gate 4 — final verification

Run narrow verification first, then broader checks when the feature touched shared code.

Required for MC TUI/e2e changes:

```bash
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test <scenario>
pnpm --filter ./mastracode run e2e:test -- --jobs 2
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

Required for focused Mastra Code source/test changes:

```bash
pnpm run build:mastracode
pnpm --filter ./mastracode test -- --run <test-file> --bail=1 --reporter=dot
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

If core changes are required:

```bash
pnpm build:core
pnpm --filter ./packages/core test -- --run <test-file> --bail=1 --reporter=dot
pnpm --filter ./packages/core check
```

Escalate to broader suites only when touched code or risk warrants it.

### Gate 5 — update docs and commit

1. Update the feature card:
   - Existing tests.
   - Missing tests now covered.
   - Any deferred contracts with rationale.
   - Verification checklist.
2. Update `.plan/mastracode-testing-recovery/test-recovery-tracker.md`:
   - Status.
   - New tests.
   - Contracts covered.
   - Verification commands.
   - Break-validation evidence.
   - Commit hash after committing.
3. Update `.plan/mastracode-testing-recovery/history.md` and `handoff.md` with concise progress.
4. Make a clean grouped commit on this branch.
   - Group by feature area.
   - If a single test group is large, commit that test group separately.
   - If a product fix is required after test proof, keep it in the same feature-area group unless it is large enough to deserve its own follow-up commit.
   - Never commit intentional break edits.
   - Include the standard co-author trailer:

```text
Co-Authored-By: Mastra Code (openai/gpt-5.5) <noreply@mastra.ai>
```

5. Push after committing so progress is recoverable remotely.

## Autonomy rules

- Do not pause after each feature unless blocked. Verification gates are for proof, not for asking permission.
- The goal judge, not the user, validates each feature/test group during the run. Record enough evidence for the judge to evaluate the work.
- Ask the user only when critical ambiguity prevents safe progress.
- Prefer fixing the tracker/feature card when it is stale, then proceed.
- Keep commits small enough to review and recover.
- Keep working until the unfinished tracker queue is exhausted or a real blocker requires user input.
- At the very end, after all tracker rows are validated or explicitly deferred, ask the user for final approval before considering the overall goal done.

## Completion criteria

The goal is complete only when:

1. The tracker contains every mapped feature that still needs test recovery.
2. Every tracker row is `validated` or explicitly deferred with a reviewed rationale.
3. Every non-deferred feature has contract coverage mapped to tests.
4. TUI-visible/TUI-triggered contracts have TUI e2e coverage.
5. LLM-dependent e2e tests use AIMock fixtures and pass with nonzero AIMock requests.
6. Realistic break-validation evidence is recorded for each new test group when practical.
7. Final focused checks and relevant package checks pass.
8. Feature cards, tracker, history, and handoff are updated.
9. Work is committed in clean grouped commits on this branch.
10. Commits are pushed after each grouped chunk.
11. The user gives final approval after the full queue is exhausted or all remaining rows are explicitly deferred.
