---
name: mastracode-testing-recovery
description: Coordinate Mastra Code testing recovery work from the shared planning docs. Use when planning, continuing, or handing off work on MC test stabilization, CI coverage, feature mapping, or TUI test harness design.
---

# Mastra Code Testing Recovery

## Operating principle

Treat everything as untrusted until verified: handoffs, prior plans, old audit docs, test results, branch assumptions, Slack claims, and agent-written summaries. Use them as leads, then verify against source files, git history, commands, logs, and current test output.

## Start here

Read these files first, in order:

1. `.plan/mastracode-testing-recovery/README.md`
2. `.plan/mastracode-testing-recovery/history.md`
3. `.plan/mastracode-testing-recovery/handoff.md`

Treat `handoff.md` as the pickup point, not as truth. It should tell you what is active, what is done, what is blocked, and what to do next, but verify claims against git status, files, commits, tests, and logs before trusting them.

## Before working

- Run `git status --short --branch`.
- Confirm whether you are doing planning work or implementation work.
- Do not create new workstream branch pages until the approach for that workstream is agreed.
- For Mastra Code test runs, follow `mastracode/AGENTS.md`: build first with `pnpm run build:mastracode`.

## During work

- Keep changes focused on the current workstream.
- Append meaningful decisions or verified progress to `.plan/mastracode-testing-recovery/history.md`.

## TUI e2e harness work

- Treat checked-in scenario files under `mastracode/scripts/mc-e2e/scenarios/` as the source of truth; do not generate scenario source or duplicate scenario logic in separate wrappers.
- For any behavior visible in, triggered from, or affected by the terminal UI, TUI e2e coverage is required before a recovery tracker row can be marked `validated`. Unit, integration, component, command, and headless tests are supporting shields, not substitutes for the user-perspective e2e gate.
- Use `pnpm --filter ./mastracode run e2e:test` for default headless pass/fail execution. It runs all scenarios through the static `@microsoft/tui-test` wrapper; pass a scenario name to run one scenario.
- Use `pnpm --filter ./mastracode run e2e:observe <scenario>` for live TUI visibility. Observe mode is for debugging and demos, not normal CI.
- Use `pnpm --filter ./mastracode run e2e:list` to list available scenarios.
- Keep e2e runs hermetic: per-scenario app data, storage DBs, project directories, provider env sanitization, AIMock replay fixtures, visible mocked response assertions, and AIMock request-count assertions.
- Real-world conversations and OM data may be read from the local Mastra Code database in the user's Application Support directory only with explicit read-only operations, then sanitized and transformed into AIMock-compatible fixtures. Never write to the local DB and never make committed or CI tests depend on it.
- Recording-driven test creation should be explicit and should never run in CI by default. Treat recorded interactions as draft tests: review them and replace brittle transcript assertions with semantic helpers before committing.

## Feature map work

- Use `.plan/mastracode-testing-recovery/features/README.md` as the feature-map index.
- Copy `.plan/mastracode-testing-recovery/features/_template.md` for each feature page.
- Organize by user-visible feature area, not implementation layer.
- Include the origin PR/commit near the top of each feature page.
- Document active streaming behavior separately from loaded-from-history/reload behavior.
- Use normal relative Markdown links for related features.

## Branch and commit flow

- Treat this branch as the planning and implementation base for the testing recovery effort.
- Do not create separate feature branches or worktrees unless the user explicitly asks.
- Commit and push in small, coherent chunks so progress is recoverable and reviewable.
- Group commits by feature area, or by individual test group when a test is large enough to review independently.
- Never commit intentional break-validation edits.
- Goal-judge validation covers feature/test-group gates during a goal run; ask the user for final approval only when the full recovery queue is exhausted or all remaining rows are explicitly deferred.
- Record branch status, commits, verification evidence, and remaining work in `handoff.md` before signing off.

## Signing off

Before stopping:

- Update `.plan/mastracode-testing-recovery/handoff.md`.
- Mark finished items as done.
- Add anything still pending as next steps.
- Record blockers, changed files, and important commands/evidence.
- Keep the handoff concise enough for the next agent to resume immediately.
