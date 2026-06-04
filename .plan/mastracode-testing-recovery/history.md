# Mastra Code testing recovery history

## 2026-06-03

### Context

Mastra Code hit several user-visible regressions during the Harness v1 migration period:
- New session creation appeared broken for some users.
- Task list state split: the TUI/context showed tasks, but task tools could not find them.
- Model/session state could reload into a broken `No model selected` state.
- Some issues reproduced only after reload from persisted memory/session state.

Slack discussion converged on the idea that this is not one isolated bug. It is a broader testing and state-ownership problem: Mastra Code has many state projections, and Harness v1 changed where some state lives.

### What we verified

We ran Mastra Code tests correctly after building workspace artifacts first:

```sh
pnpm run build:mastracode
pnpm test:mastracode -- --run --reporter=verbose
```

We also checked a pre-Harness v1 baseline in a detached worktree at:

```text
3abcdd2da7c3c5a4b6d49e39beaf29c7d39d0f16 chore(core): rename legacy harness class
```

Result: the existing test suite did not catch a convincing Harness v1 regression. The scariest headless abort timeout already failed before Harness v1, and several other failures were test/env noise.

Comparison docs:
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-HEAD.md`
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1.md`
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1-vs-HEAD.md`

### Decisions

We decided the recovery plan should have four broad workstreams:

1. Stabilize the existing test baseline.
2. Re-enable Mastra Code tests in CI.
3. Build a graph-like feature map for all intended Mastra Code behavior.
4. Design a real Mastra Code test harness for running the actual TUI with mocked model endpoints.

We also decided to start with an index only. Branch pages should not be created until the approach for that workstream is agreed.

### Branch strategy

This branch should act as the planning base.

Implementation should happen on branches off this branch, preferably as focused stacked PRs. When a PR is ready to merge, rebase/cherry-pick only the implementation commits onto `main` so planning-file commits are not dragged into product/code PRs.

### Next steps

1. Agree on the detailed approach for workstream 1: stabilizing the existing test baseline.
2. Create the first branch page only after that approach is agreed.
3. Then branch from this planning branch for the first implementation PR.

## 2026-06-04

### AIMock exploration

Researched `@copilotkit/aimock@1.28.0` as a candidate mocked-model endpoint for workstream 4. Wrote findings to:

- `explorations/mastracode-testing-recovery/aimock-exploration.md`

Bottom line: AIMock looks promising for a first real MC harness spike if we route MC through an OpenAI-compatible/custom-provider path. It should not be treated as proven for Claude Max/Codex OAuth paths until a spike verifies base URL routing.

### Feature map structure

Agreed that the feature map should be hierarchical Markdown organized by user-visible feature area, not implementation layer. Each concrete feature page should copy `.plan/mastracode-testing-recovery/features/_template.md`, include an origin PR/commit near the top, and use normal relative Markdown links for related features.

Created:

- `.plan/mastracode-testing-recovery/features/README.md`
- `.plan/mastracode-testing-recovery/features/_template.md`

### Skill and feature-map command split

Kept `mastracode-testing-recovery` as a normal skill for the shared operating protocol. Created a goal-enabled custom command for the concrete feature-map job instead of relying on goal-skill loading.

Use:

```text
/goal/map-mc-features [optional scope]
```

Command file:

- `.mastracode/commands/map-mc-features.md`

The command should first list the PR queue from squash-merged `mastracode/` commit history, then process PRs oldest-to-newest. For each PR it reviews the actual originating PR, verifies current source/tests, creates feature pages for new user-visible behavior, and updates earlier pages when later PRs modify documented features.

### Feature map batch 1

Generated `.plan/mastracode-testing-recovery/features/_pr-queue.md` from `git log --reverse --date=short --name-only --pretty=format:'...' -- mastracode`.

Queue summary:

- 493 commits touch `mastracode/`.
- 358 commits have squash-merge PR numbers.
- 251 were initially flagged as likely user-visible or test-relevant and still need verification.

Processed PR [#13218](https://github.com/mastra-ai/mastra/pull/13218), `0e64154f1b` (`MastraCode initial port (#13218)`) as a foundation batch. Wrote initial pages:

- `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md`
- `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md`
- `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md`
- `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md`

These pages are intentionally broad baselines from the initial port. Later PR passes should update them in place when behavior changed, especially for thread reload, model/mode preservation, tool/task rendering, permissions, and streaming-vs-history behavior.
