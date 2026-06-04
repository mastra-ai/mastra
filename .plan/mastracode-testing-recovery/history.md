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

### Feature map structure correction

User feedback: the first 4 feature pages were too long. Stop writing more feature-page content until the index/page shape is tightened.

Updated `.plan/mastracode-testing-recovery/features/README.md` to make the index table the source of truth and updated `_template.md` into a concise card format.

Shrank the 4 existing baseline pages to the concise card format before processing more PRs:

- `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md`
- `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md`
- `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md`
- `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md`

Next queue checkpoint remains PR #13227.

### Feature map PR #13227

Processed PR [#13227](https://github.com/mastra-ai/mastra/pull/13227), `5013f35869` (`MC follow up 1 (#13227)`). Verified current subagent definitions, dynamic workspace behavior, `/subagents` command, and subagent render tests.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/subagents/delegation.md`.
- Added the subagents row to the source-of-truth table in `features/README.md`.
- Linked subagents from `features/tools/coding-tools-permissions.md`.

Next queue checkpoint: PR #13231.

### Feature map PR #13231

Processed PR [#13231](https://github.com/mastra-ai/mastra/pull/13231), `6515d301d4` (`More cleanup (#13231)`). Verified current dynamic memory factory, `/om` command wiring, OM handlers/tests, context-aware tools, and gateway heartbeat sync.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/memory/observational-memory.md`.
- Added the memory row to the source-of-truth table in `features/README.md`.
- Added #13231 as a later change on model and tools cards.

Next queue checkpoint: PR #13234.

### Feature map PR #13234

Processed PR [#13234](https://github.com/mastra-ai/mastra/pull/13234), `4e28562012` (`MC fixes (#13234)`). PR body was blank; verified via commit diff and current source/tests. Most changes were structural/type/build cleanup, but the durable user-visible behavior is dynamic prompt context and project instruction assembly.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/chat/prompt-context.md`.
- Added the prompt-context row to the source-of-truth table in `features/README.md`.
- Marked the rest of #13234 as structural cleanup after source verification.

Next queue checkpoint: PR #13239.

### Feature map PR #13239

Processed PR [#13239](https://github.com/mastra-ai/mastra/pull/13239), `9bbf08e3c2` (`fix(core): use structural typing for ZodLikeSchema to prevent tsc OOM (#13239)`). Verified PR body, commit diff, current core schema references, and representative Mastra Code tool diffs.

Documentation action: skipped feature-page creation. This PR was type/build stability work for `ZodLikeSchema` and caused broad Mastra Code formatting/type churn, but no new or changed user-visible Mastra Code behavior was identified.

Risk/test note: keep Mastra Code tool typechecking/build coverage in mind for workstream 1/CI because this PR existed to prevent TypeScript OOM around `createTool` schema inference.

Next queue checkpoint: PR #13245.

### Feature map PR #13245

Processed PR [#13245](https://github.com/mastra-ai/mastra/pull/13245), `6fdd3d451a` (`Harness primitive (#13245)`). Verified PR metadata, commit stats/name-status, current `HarnessCompat`, `index.ts`, TUI event dispatch, prompt handlers, and tool approval tests.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md` for the prototype-to-core Harness event migration.
- Updated `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md` for core Harness session records.
- Updated `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md` for mode/model runtime ownership in core Harness sessions.
- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` for core Harness tool/question/plan approval primitives.

No separate Harness feature page was created because the feature map is organized by user-visible behavior, not runtime layer.

Next queue checkpoint: PR #13250.

### Feature map PR #13037 and #13250

Processed PR [#13037](https://github.com/mastra-ai/mastra/pull/13037), `a0b5df263a` (`chore: version packages (alpha) (#13037)`). Verified it was a Changesets alpha version-package PR touching `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation because it did not introduce or change user-visible Mastra Code behavior.

Processed PR [#13250](https://github.com/mastra-ai/mastra/pull/13250), `4f2e364945` (`fix(mastracode): ESM module resolution error on startup (#13250)`). Verified PR body, commit diff, and current `mastracode/src/lsp/client.ts` imports from `vscode-jsonrpc/node.js`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` because this fix preserves LSP-backed tool availability and packaged startup.
- Added a missing-test note for packaged startup/import smoke coverage.

Next queue checkpoint: PR #13251, likely version packaging; next review PR after that is #13253.

### Feature map PR #13251 and #13253

Processed PR [#13251](https://github.com/mastra-ai/mastra/pull/13251), `a20fbeff59` (`chore: version packages (alpha) (#13251)`). Verified it was a Changesets alpha version-package PR for the #13250 patch; skipped feature-page creation because it did not introduce or change user-visible behavior beyond the already-mapped #13250 fix.

Processed PR [#13253](https://github.com/mastra-ai/mastra/pull/13253), `1415bcd894` (`fix(schema-compat): fix zodToJsonSchema routing for v3/v4 schemas (#13253)`). Verified PR body, touched Mastra Code tool schema imports, current remaining custom tools, and `packages/schema-compat/src/zod-to-json.ts` / `zod-to-json.test.ts`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` because this preserves tool-call schema compatibility between source checkout and global install environments.
- Added schema-compat tests and missing end-to-end packaged/source tool schema coverage to the card.

Next queue checkpoint: PR #13252, likely version packaging; next review PR after that is #13255.

### Feature map PR #13252 and #13255

Processed PR [#13252](https://github.com/mastra-ai/mastra/pull/13252), `f090302af0` (`chore: version packages (alpha) (#13252)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation.

Processed PR [#13255](https://github.com/mastra-ai/mastra/pull/13255), `d715911c91` (`feat(mastracode): add separate export path for MastraTUI (#13255)`). Verified current `mastracode/package.json` exports `./tui`, `mastracode/tsup.config.ts` builds the `tui` entry, and `mastracode/src/tui/index.ts` exports the public TUI surface.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md` because this is a public TUI consumption surface, not a separate runtime feature.
- Added missing built-package import smoke coverage for `mastracode/tui`.

Next queue checkpoint: PR #13257, likely version packaging; next review PR after that is #13305.

### Feature map PR #13257 and #13305

Processed PR [#13257](https://github.com/mastra-ai/mastra/pull/13257), `834b03e500` (`chore: version packages (alpha) (#13257)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation.

Processed PR [#13305](https://github.com/mastra-ai/mastra/pull/13305), `b2601234bd` (`fix(memory): improve OM activation chunk selection and safeguards (#13305)`). Verified PR body, current `mastracode/src/agents/memory.ts`, and current core OM threshold/runtime/tests under `packages/memory/src/processors/observational-memory/`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/memory/observational-memory.md` because this changes OM activation/retention behavior visible as background memory stability.
- Recorded that current Mastra Code defaults differ from the #13305 PR body, so later PRs may have changed the intended `bufferActivation` / `blockAfter` values.
- Updated `_pr-queue.md` status markers: #13257 skipped, #13305 done, #13294 current, #13330 next.

Next queue checkpoint: PR #13294, docs/install instructions; next review PR after that is #13330.

### Feature map PR #13294 and #13330

Processed PR [#13294](https://github.com/mastra-ai/mastra/pull/13294), `a8e92aec01` (`chore(mastracode): Update installation instructions (#13294)`). Verified PR body and current `mastracode/README.md`, `mastracode/package.json`, `mastracode/src/main.ts`, and `mastracode/src/headless.ts`.

Processed PR [#13330](https://github.com/mastra-ai/mastra/pull/13330), `608e156def` (`fix: restore OM status updates and model change events in harness (#13330)`). Verified PR body, current `/om` command callbacks, core harness OM stream chunk handlers, and core OM harness tests.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/setup/installation-and-launch.md` because installation/launch is a user-facing entry path.
- Updated `.plan/mastracode-testing-recovery/features/memory/observational-memory.md` for streamed OM lifecycle events and observer/reflector model-switch events.
- Updated feature index and `_pr-queue.md` status markers: #13294 done, #13330 done, #13331 current, #13328 next.

Next queue checkpoint: PR #13331 (`audit-tests` subagent), then PR #13328 (incremental tool argument streaming).

### Feature map PR #13331 and #13328

Processed PR [#13331](https://github.com/mastra-ai/mastra/pull/13331), `3ea22d7703` (`feat(mastracode): add audit-tests subagent (#13331)`). Verified PR body, current `mastracode/src/agents/subagents/audit-tests.ts`, current `mastracode/src/index.ts`, and prompt guidance. Created `features/subagents/audit-tests.md` and noted the current registration gap: the definition exists, but default subagents are only `explore`, `plan`, and `execute`.

Processed PR [#13328](https://github.com/mastra-ai/mastra/pull/13328), `45bb78b70b` (`feat: stream tool arguments incrementally across all tool renderers (#13328)`). Verified current core harness tool-input events/display-state buffers, TUI event dispatch, `handleToolInputDelta()`, tool component `updateArgs()`, and loaded-history rendering from stored final tool calls.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/subagents/audit-tests.md`.
- Created `.plan/mastracode-testing-recovery/features/tools/streaming-tool-arguments.md`.
- Updated subagent/tool cards with cross-links and later-change references.
- Updated feature index and `_pr-queue.md` status markers: #13331 done, #13328 done, #13335 current, #13307 next.

Next queue checkpoint: PR #13335 (preserve assistant text across `todo_write`/task tool calls), then PR #13307 (reload auth storage before OpenAI Codex model resolution).

### Feature map PR #13335 and #13307

Processed PR [#13335](https://github.com/mastra-ai/mastra/pull/13335), `7f317fc5e4` (`fix(tui): preserve assistant message text across todo_write tool calls (#13335)`). Verified the current renamed task-tool path in `mastracode/src/tui/handlers/tool.ts`: task mutation tools create a pending tool entry, record `taskToolInsertIndex`, and create a fresh `AssistantMessageComponent` so pre-tool assistant text is not overwritten while post-tool content streams.

Processed PR [#13307](https://github.com/mastra-ai/mastra/pull/13307), `12e4819fe2` (`fix(mastracode): reload auth storage before resolving OpenAI Codex model (#13307)`). Verified current `mastracode/src/agents/model.ts` calls `authStorage.reload()` at the start of `resolveModel()`, then reads OpenAI Codex OAuth/API key credentials from the refreshed store. Existing `model.test.ts` has a generic reload assertion, but no OpenAI Codex-specific stale-credential regression test.

Documentation actions:

- Updated `features/tools/streaming-tool-arguments.md` with #13335 task-tool streaming split behavior and missing regression test.
- Updated `features/models/model-auth-and-modes.md` with #13307 AuthStorage reload behavior and missing Codex stale-credential test.
- Updated `_pr-queue.md` status markers: #13335 done, #13307 done, #13334 current, #13339 next.

Next queue checkpoint: PR #13334 (thread lock config), then PR #13339 (subagent parallel-only and verification guidance).

### Feature map PR #13334 and #13339

Processed PR [#13334](https://github.com/mastra-ai/mastra/pull/13334), `24b80af87d` (`feat(harness): add optional threadLock config for concurrent thread access protection (#13334)`). Verified current MC wiring in `mastracode/src/index.ts`: `HarnessCompat` receives `threadLock` callbacks backed by `acquireThreadLock`/`releaseThreadLock` when cross-process pubsub is unavailable. Verified core Harness behavior in `packages/core/src/harness/harness.ts` and `thread-locking.test.ts`: select/create/switch acquire locks, release old locks after successful acquire, and restore previous lock state on acquire/save failure.

Processed PR [#13339](https://github.com/mastra-ai/mastra/pull/13339), `b322502d4a` (`feat(mastracode): add subagent parallel-only and verification guidance (#13339)`). Verified current `base.ts` includes the parallel-only subagent rule with an `audit-tests` exception. Current `tool-guidance.ts` still has the parallel-only rule but does not mention the audit-tests exception, so the documentation records a help-text consistency gap.

Documentation actions:

- Updated `features/threads/persistent-conversations.md` with #13334 thread-lock ownership, key files, core tests, and missing MC lock-prompt integration test.
- Updated `features/subagents/delegation.md` with #13339 parallel-only guidance ownership and missing consistency test.
- Updated `features/subagents/audit-tests.md` with #13339 as a later change and the remaining registration/help-text gaps.
- Updated `_pr-queue.md` status markers: #13334 done, #13339 done, #13343 current, #13344 next.

Next queue checkpoint: PR #13343 (scope thread auto-resume to current directory), then PR #13344 (todo tools moved to core and renamed to task).

### Feature map PR #13343 and #13344

Processed PR [#13343](https://github.com/mastra-ai/mastra/pull/13343), `2b2e157a09` (`fix: scope thread auto resume to current directory to make worktrees easier to use (#13343)`). Verified current `mastracode/src/tui/setup.ts`: startup thread selection filters by `thread.metadata.projectPath`, falls back to directory birthtime for legacy untagged threads, and retroactively tags resumed untagged threads with the current path.

Processed PR [#13344](https://github.com/mastra-ai/mastra/pull/13344), `c204b632d1` (`refactor: move todo tools to @mastra/core/harness and rename to task (#13344)`). Verified current core task tools in `packages/core/src/harness/tools.ts`, TUI task progress rendering, `task_updated` event handling, prompt `<current-task-list>` injection, permissions, and subagent restrictions.

Documentation actions:

- Updated `features/threads/persistent-conversations.md` with #13343 worktree/current-directory auto-resume behavior and missing startup filtering tests.
- Created `features/tools/task-tracking.md` for the task tool/TUI progress feature.
- Updated `features/tools/coding-tools-permissions.md` and `features/tools/streaming-tool-arguments.md` with #13344 later-change references and links to task tracking.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13343 done, #13344 done, #13345 current, #13311 next.

Next queue checkpoint: PR #13345 (Ctrl+F autocomplete/queued slash commands), then PR #13311 (`/mcp` manager wiring).

### Feature map PR #13345 and #13311

Processed PR [#13345](https://github.com/mastra-ai/mastra/pull/13345), `7aedfb7ff9` (`feat(tui): resolve autocomplete and queue slash commands on Ctrl+F (#13345)`). Verified current Ctrl+F path across `mastracode/src/tui/components/custom-editor.ts`, `setup.ts`, `mastra-tui.ts`, and `handlers/agent-lifecycle.ts`: Ctrl+F accepts slash autocomplete, stores queued actions in FIFO TUI state, and drains queued slash commands through `handleSlashCommand()` after `agent_end`.

Processed PR [#13311](https://github.com/mastra-ai/mastra/pull/13311), `d1b596fb05` (`fix(mastracode): wire mcpManager to TUI so /mcp command works (#13311)`). Verified `mastracode/src/main.ts` passes `mcpManager` into `MastraTUI`, `state.ts` stores it, `mastra-tui.ts` includes it in `SlashCommandContext`, and `commands/mcp.ts` reads `ctx.mcpManager` for status/reload/selector behavior.

Documentation actions:

- Created `features/chat/queued-followups.md` for Ctrl+F queued follow-up and slash-command behavior.
- Created `features/integrations/mcp-status-command.md` for `/mcp` status/reload behavior.
- Updated `features/tui/interactive-chat.md` and `features/tools/coding-tools-permissions.md` with later-change references and links.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13345 done, #13311 done, #13346 current, #13347 next.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/components/__tests__/custom-editor.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1` (66 tests).

Next queue checkpoint: PR #13346 (AGENTS.md instruction loading), then PR #13347 (MCP manager factory refactor).

### Feature map PR #13346 and #13347

Processed PR [#13346](https://github.com/mastra-ai/mastra/pull/13346), `e399dcba4f` (`fix(mastracode): load AGENTS.md instruction files, drop deprecated AGENT.md (#13346)`). Verified current `mastracode/src/agents/prompts/agent-instructions.ts`: static instruction discovery checks `AGENTS.md` before `CLAUDE.md`, no longer checks singular `AGENT.md`, scans global/project/config-dir locations, and feeds ignored static paths into `AgentsMDInjector` through `mastracode/src/index.ts`.

Processed PR [#13347](https://github.com/mastra-ai/mastra/pull/13347), `48d19d89e0` (`refactor: replace MCPManager class with factory function (#13347)`). Verified current `mastracode/src/mcp/manager.ts`: `createMcpManager()` returns the `McpManager` interface with closure-owned config/tools/status/log state; `mastracode/src/agents/tools.ts`, `index.ts`, `main.ts`, and `/mcp` still consume the same manager instance for tools/status/reload/cleanup.

Documentation actions:

- Updated `features/chat/prompt-context.md` with #13346 `AGENTS.md` static instruction loading and missing precedence tests.
- Updated `features/integrations/mcp-status-command.md` and `features/tools/coding-tools-permissions.md` with #13347 manager factory/interface behavior.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13346 done, #13347 done, #13348 current, #13349 next.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/agents/__tests__/prompts.test.ts src/agents/prompts/index.test.ts src/mcp/__tests__/manager.test.ts --reporter=dot --bail 1` (52 tests).

Next queue checkpoint: PR #13348 (tool result token limits), then PR #13349 (OM buffer activation threshold).


### Feature map PR #13348 and #13349

Processed PR [#13348](https://github.com/mastra-ai/mastra/pull/13348), `4137924b3f` (`fix: limit tool result token sizes for view, grep, and web tools (#13348)`). Verified current `mastracode/src/tools/web-search.ts` caps web-search and web-extract output at 2k estimated tokens, while file/search/shell-style workspace output limits now live in `packages/core/src/workspace/tools/output-helpers.ts` with `DEFAULT_MAX_OUTPUT_TOKENS = 2_000`.

Processed PR [#13349](https://github.com/mastra-ai/mastra/pull/13349), `5f1f0fa8a3` (`fix: raise memory buffer activation threshold to prevent aggressive window shrinking (#13349)`). Verified the PR temporarily raised observation `bufferActivation` from 2000 to 4000, but current `mastracode/src/agents/memory.ts` is back to `bufferActivation: 2000` for thread scope; `git blame` shows later OM precision/scope work changed the current defaults.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13348 tool-output budget ownership, key files, and missing web-tool truncation test.
- Updated `features/memory/observational-memory.md` with #13349's temporary threshold change and current-default drift risk.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13348 done, #13349 done, #13350 current, #13355 next.

Next queue checkpoint: PR #13350 (TUIState extraction), then PR #13355 (`view_range` directory listing fix).
