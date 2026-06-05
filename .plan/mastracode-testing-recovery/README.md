# Mastra Code testing recovery plan

## Goal

Make Mastra Code safe to refactor and release by turning today’s manual validation into reliable tests, CI guardrails, feature documentation, and reusable agent workflows.

This plan should become the coordination base for the testing recovery effort: we plan here, branch from here, and then ship focused implementation PRs from stacked branches.

## How to resume this work

Use the `mastracode-testing-recovery` skill for the overall operating protocol: verify everything, read the handoff, follow branch flow, and update history/handoff.

Use [`test-recovery-system.md`](./test-recovery-system.md) as the draft system for turning the completed feature map into regression-shield test coverage.

Use [`tui-aimock-discovery.md`](./tui-aimock-discovery.md) for the first-pass findings on `@microsoft/tui-test`, AIMock, AIMock record/replay, and the recommended Mastra Code e2e harness shape.

For feature-map documentation, start a goal from the project command:

```text
/goal/map-mc-features [optional scope]
```

Examples:

```text
/goal/map-mc-features
/goal/map-mc-features threads
```

The command lives at `.mastracode/commands/map-mc-features.md`. It first lists the Mastra Code PR queue from squash-merged commit history, then processes PRs oldest-to-newest. For each PR it reviews the originating PR, verifies current code/tests, creates pages for new user-visible features, and updates existing pages when later PRs modify earlier documented behavior.

## Overall approach

Use this branch as the planning base. Keep the plan files here so the work stays coherent, but do not ship plan-file churn in every implementation PR.

For implementation work:
- Branch off this planning branch for each focused workstream or PR.
- Make small stacked PRs where possible.
- Commit and push in small, coherent chunks so progress is recoverable and reviewable.
- When a PR is ready to merge, change its base to `main` and rebase/cherry-pick only the implementation commits onto `main`.
- Leave planning-only commits behind on this branch unless the plan docs themselves are the PR.
- Keep appending progress to [`history.md`](./history.md) so later agents can pick up context quickly.

## Workstreams

### 1. Stabilize the existing test baseline

Purpose: fix or quarantine current test failures so the suite becomes a trustworthy signal.

Initial scope:
- Build first with `pnpm run build:mastracode`.
- Sanitize provider env so local credentials do not affect model tests; preferred fix is for `mastracode/src/agents/__tests__/model.test.ts` to clear provider `*_API_KEY` variables in its own setup.
- Fix known mock/fixture drift.
- Separate pre-existing noise from real regressions.

Status: not yet planned.

### 2. Re-enable Mastra Code tests in CI

Purpose: ensure Mastra Code tests actually run before changes merge.

Initial scope:
- Add CI coverage for `pnpm run build:mastracode`.
- Run `pnpm test:mastracode -- --run` after build.
- Keep env sanitized in CI.
- Decide whether failures block immediately or after baseline stabilization.

Status: not yet planned.

### 3. Build a graph-like feature map

Purpose: document all intended Mastra Code behavior in a structure agents and humans can navigate.

Initial shape:
- Organize by user-visible feature area, not implementation layer.
- Put concrete behavior pages under `.plan/mastracode-testing-recovery/features/`.
- Use [`features/_template.md`](./features/_template.md) for required sections.
- Link related features with normal relative Markdown links.
- Include the origin PR/commit near the top of each feature page.

Status: initial structure recorded in [`features/README.md`](./features/README.md).

### 4. Design a real Mastra Code test harness

Purpose: test the running TUI and product behavior, not only implementation units.

Initial scope:
- Run the real built TUI locally.
- Send input through a PTY or equivalent driver.
- Inspect rendered TUI state/output.
- Provide mocked model endpoints MC can connect to.
- Investigate tools like `aimock` only after requirements are clear.
- Convert the resulting workflow into skills for writing and running MC tests.

Status: not yet planned.

## Planning rule

Do not create branch pages for a workstream until we agree on that workstream’s approach.

When agreed, add a linked page from this README and flesh it out separately.
