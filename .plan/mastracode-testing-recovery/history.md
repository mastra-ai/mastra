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


### Feature map PR #13350 and #13355

Processed PR [#13350](https://github.com/mastra-ai/mastra/pull/13350), `e65ec08031` (`refactor: extract TUI state into dedicated TUIState interface and factory (#13350)`). Verified current `mastracode/src/tui/state.ts` owns the shared `TUIState`, `MastraTUIOptions`, and `createTUIState()` factory defaults, and `mastracode/src/tui/index.ts` exports `createTUIState` / `TUIState` through `mastracode/tui`.

Processed PR [#13355](https://github.com/mastra-ai/mastra/pull/13355), `89b1a4aead` (`fix(mastracode): allow view_range for directory listings (#13355)`). Verified the original fix in deleted `mastracode/src/tools/file-view.ts` allowed `view_range` to slice directory listings and tolerate null range entries. Current source no longer has literal `view_range`; the replacement is split core workspace tools: `read_file` supports file `offset` / `limit`, while `list_files` handles directory trees without offset/limit pagination.

Documentation actions:

- Updated `features/tui/interactive-chat.md` with #13350 shared TUI state/public export behavior and missing `createTUIState()` default-shape tests.
- Updated `features/tools/coding-tools-permissions.md` with #13355's historical directory pagination fix, current split core tool behavior, and missing current pagination-regression coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13350 done, #13355 done, #13354 current, #13353 next.

Next queue checkpoint: PR #13354 (OM continuity at low activation), then PR #13353 (Harness object-parameter refactor/reference docs).


### Feature map PR #13354 and #13353

Processed PR [#13354](https://github.com/mastra-ai/mastra/pull/13354), `78d1c808ad` (`fix(memory): improve OM continuity at low activation (#13354)`). Verified current OM code preserves continuation hints (`currentTask`, `suggestedContinuation`) through observer output, async buffered chunks, activation results, and thread OM metadata. Current degenerate-output handling lives in `packages/memory/src/processors/observational-memory/observer-runner.ts`: retry once, then fail if still degenerate.

Processed PR [#13353](https://github.com/mastra-ai/mastra/pull/13353), `59d30b5d0c` (`refactor(harness): use object parameters for all Harness methods + add reference docs (#13353)`). Verified current `packages/core/src/harness/harness.ts` object-param methods and current Mastra Code call sites in TUI/headless handlers. Also verified `docs/src/content/en/reference/harness/harness-class.mdx` documents object-param examples.

Documentation actions:

- Updated `features/memory/observational-memory.md` with #13354 continuation-hint behavior, state ownership, key files, tests, and stale-hint risk.
- Created `features/integrations/harness-api.md` for #13353's external Harness API/reference-doc surface.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13354 done, #13353 done, #13260 current, #13416 next.

Next queue checkpoint: PR #13260 (likely version-package skip), then PR #13416 (plan mode agent calls `submit_plan`).


### Feature map PR #13260 and #13416

Skipped PR [#13260](https://github.com/mastra-ai/mastra/pull/13260), `e610573a4c` (`chore: version packages (alpha) (#13260)`). Verified via PR metadata and `git show` that Mastra Code changes were `mastracode/CHANGELOG.md` and `mastracode/package.json` version/package churn only; no user-visible feature mapping needed.

Processed PR [#13416](https://github.com/mastra-ai/mastra/pull/13416), `9a3d857436` (`fix(mastracode): plan mode agent now calls submit_plan tool (#13416)`). Verified current source: `plan.ts` requires calling `submit_plan`, `tool-guidance.ts` exposes `submit_plan` only in Plan mode when not denied, core `submitPlanTool` emits `plan_approval_required`, TUI `handlePlanApproval()` resolves approve/reject/goal actions, and `renderExistingMessages()` reconstructs persisted `submit_plan` results as resolved plan cards.

Documentation actions:

- Created `features/goals/plan-approval.md` for Plan-mode `submit_plan` approval and Build/goal handoff behavior.
- Updated `features/chat/prompt-context.md` with #13416's mode-aware tool guidance dependency.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13260 skipped, #13416 done, #13413 current, #13385 next.

Next queue checkpoint: PR #13413 (TUI modularization), then PR #13385 (TS/JS LSP language identifier fix).


### Feature map PR #13413 and #13385

Processed PR [#13413](https://github.com/mastra-ai/mastra/pull/13413), `f08b0bb00b` (`refactor: modularize TUI into focused modules (#13413)`). Verified current source keeps `mastracode/src/tui/mastra-tui.ts` as a thin lifecycle wrapper and routes events through extracted modules: `event-dispatch.ts`, `handlers/*`, `setup.ts`, `render-messages.ts`, `status-line.ts`, and `shell.ts`. No new user-visible feature page needed; this is a structural refactor of the existing interactive chat surface.

Processed PR [#13385](https://github.com/mastra-ai/mastra/pull/13385), `18553c3541` (`fix(mastracode): use correct LSP language identifier for TS/JS files (#13385)`). Verified current core workspace LSP path maps extensions via `getLanguageId()` (`.ts` → `typescript`, `.tsx` → `typescriptreact`, `.js` → `javascript`, `.jsx` → `javascriptreact`) before `notifyOpen()`. The original MC-owned `string-replace-lsp.ts` path no longer exists at HEAD; current active behavior lives in `packages/core/src/workspace/lsp/*` and `tools/lsp-inspect.ts`, with a legacy MC-local language map still present.

Documentation actions:

- Updated `features/tui/interactive-chat.md` with #13413 modularized handler/event/status/shell ownership and routing risk.
- Updated `features/tools/coding-tools-permissions.md` with #13385 LSP language-ID behavior, current core LSP ownership, tests, and missing direct language-mapping coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13413 done, #13385 done, #13384 current, #13376 next.

Next queue checkpoint: PR #13384 (hidden-file directory listings), then PR #13376 (model name in Co-Authored-By commit message).


### Feature map PR #13384 and #13376

Processed PR [#13384](https://github.com/mastra-ai/mastra/pull/13384), `8af03582df` (`fix(mastracode): exclude hidden files from directory listings (#13384)`). Verified the original fix corrected an over-escaped shell `find` pattern in the old MC-owned `file-view.ts` / `file-editor.ts` tools. Current source has migrated directory listing to core workspace: `packages/core/src/workspace/tools/list-files.ts` exposes `showHidden` defaulting false, and `tree-formatter.ts` filters entries whose names start with `.` unless `showHidden` is true. `list-files.test.ts` directly covers default dotfile exclusion and opt-in visibility.

Processed PR [#13376](https://github.com/mastra-ai/mastra/pull/13376), `7429026f6c` (`feat(mastracode): include model name in Co-Authored-By commit message (#13376)`). Verified current prompt path copies `state.currentModelId` into `PromptContext.modelId`, passes it through `buildFullPrompt()`, and formats the Git Safety line as `Co-Authored-By: Mastra Code (<model-id>) <noreply@mastra.ai>` when present, with the old model-less fallback when absent.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13384 hidden-file listing behavior, current core ownership, tests, and provider-consistency risk.
- Created `features/git/commit-attribution.md` for #13376 commit attribution behavior and missing direct prompt/commit tests.
- Updated `features/chat/prompt-context.md` with #13376's model-aware commit guidance dependency.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13384 done, #13376 done, #13421 current, #13431 next.

Next queue checkpoint: PR #13421 (interactive onboarding/global settings), then PR #13431 (Codex default model change).


### Feature map PR #13421 and #13431

Processed PR [#13421](https://github.com/mastra-ai/mastra/pull/13421), `27644fbf25` (`feat(mastracode): add interactive onboarding flow and global settings (#13421)`). Verified current source adds first-run `/setup` onboarding through `OnboardingInlineComponent`, provider-filtered mode/OM packs, global `settings.json`, `/models` pack switching/import/edit/share helpers, startup `resolveModelDefaults()` / `resolveOmRoleModel()` plumbing, and live `applyOnboardingResult()` writes to harness state, thread settings, subagent model IDs, and saved settings.

Processed PR [#13431](https://github.com/mastra-ai/mastra/pull/13431), `bb82abe5e9` (`fix(mastracode): default codex model from 5.3 to 5.2 (#13431)`). Verified current source no longer matches that temporary default: `PROVIDER_DEFAULT_MODELS['openai-codex']` and `getAvailableModePacks()` now use `openai/gpt-5.5` for OpenAI plan/build, and `packs.test.ts` asserts the current value.

Documentation actions:

- Created `features/settings/onboarding-and-global-settings.md` for first-run setup, persisted settings, mode packs, OM packs, and YOLO/quiet preference state ownership.
- Updated `features/models/model-auth-and-modes.md` with #13421 pack/settings ownership and #13431 current-default drift.
- Updated `features/memory/observational-memory.md` with #13421 OM pack defaults.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13421 done, #13431 done, #13422 current, #13428 next.

Next queue checkpoint: PR #13422 (ASCII art banner), then PR #13428 (read_file view rendering).


### Feature map PR #13422 and #13428

Processed PR [#13422](https://github.com/mastra-ai/mastra/pull/13422), `d1abce8a51` (`feat(mastracode): Add ASCII art banner header with purple gradient (#13422)`). Verified current source renders a responsive startup banner with `renderBanner(version, appName)`: full `MASTRA CODE` block art for wide terminals, short `MASTRA` block art for medium terminals, and a compact single-line fallback for narrow terminals or custom app names. Current code uses Mastra green gradient stops despite the PR title/body saying purple.

Processed PR [#13428](https://github.com/mastra-ai/mastra/pull/13428), `6f927b2103` (`fix(tui): fix view tool rendering for workspace read_file output (#13428)`). Verified current source remaps core workspace `read_file` to the Mastra Code `view` tool, and `ToolExecutionComponentEnhanced` strips workspace-style `→` line-number separators plus workspace read headers before syntax-highlighted rendering. Current workspace setup no longer exposes raw duplicate `mastra_workspace_*` names for normal tool display; it remaps core workspace tools through `TOOL_NAME_OVERRIDES`.

Documentation actions:

- Created `features/tui/startup-banner.md` for #13422 startup header behavior.
- Updated `features/tui/interactive-chat.md` with banner layout relationship and tests.
- Updated `features/tools/coding-tools-permissions.md` with #13428 view-output rendering behavior and missing expanded-renderer coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13422 done, #13428 done, #13426 current, #13427 next.

Next queue checkpoint: PR #13426 (simplified help commands), then PR #13427 (HarnessDisplayState).


### Feature map PR #13426 and #13427

Processed PR [#13426](https://github.com/mastra-ai/mastra/pull/13426), `5839d227b4` (`feat(mastracode): simplify suggested help commands (#13426)`). Verified current source routes `/help` through `handleHelpCommand()` and `buildHelpText()`, producing compact command, custom command, shell, and keyboard-shortcut sections. Startup layout now points users to `⇧+Tab cycle modes` and `/help info & shortcuts` instead of showing the older long suggested-command list.

Processed PR [#13427](https://github.com/mastra-ai/mastra/pull/13427), `d4701f7e24` (`feat(core): add HarnessDisplayState for UI-agnostic display state (#13427)`). Verified current core Harness owns `HarnessDisplayState`, updates it inside `applyDisplayStateUpdate()` for lifecycle/message/tool/prompt/subagent/OM/task events, emits `display_state_changed` after raw events, and offers coalesced/cloned `subscribeDisplayState()` snapshots through `DisplayStateScheduler`. Mastra Code currently uses this projection for status-line refresh and task/history reconciliation while still handling many raw events directly.

Documentation actions:

- Created `features/tui/help-and-shortcuts.md` for #13426 compact `/help` and startup hint behavior.
- Created `features/integrations/harness-display-state.md` for #13427 display-state API behavior.
- Updated `features/tui/interactive-chat.md`, `features/tui/startup-banner.md`, `features/integrations/harness-api.md`, `features/tools/streaming-tool-arguments.md`, `features/tools/task-tracking.md`, and `features/memory/observational-memory.md` with display-state/help relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13426 done, #13427 done, #13435 current.

Next queue checkpoint: PR #13435 (PostgreSQL opt-in storage backend + libsql settings UI), then PR #13405 (likely version skip).


### Feature map PR #13435 and #13405

Processed PR [#13435](https://github.com/mastra-ai/mastra/pull/13435), `decccfdf65` (`feat(mastracode): add PostgreSQL opt-in storage backend + libsql settings ui (#13435)`). Verified current source resolves storage in priority order: env vars, global `settings.json`, legacy `.mastracode/database.json`, then default local LibSQL. `/settings` now exposes a Storage backend picker for LibSQL/PostgreSQL connection strings, saves the choice, stops the TUI, and requires restart. `createStorage()` tests PostgreSQL on startup and falls back to LibSQL with a warning so the user can still fix settings.

Processed PR [#13405](https://github.com/mastra-ai/mastra/pull/13405), `424bd890be` (`chore: version packages (alpha) (#13405)`). Verified it is alpha package version/CHANGELOG churn for Mastra Code and package metadata only; no feature page needed.

Documentation actions:

- Created `features/settings/storage-backend.md` for storage backend selection, config precedence, fallback behavior, vector-store pairing, and restart/migration risks.
- Updated `features/settings/onboarding-and-global-settings.md` with #13435 storage settings ownership.
- Updated `features/threads/persistent-conversations.md` and `features/memory/observational-memory.md` with storage backend dependencies.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13435 done, #13405 skipped, #13456 current.

Next queue checkpoint: PR #13456 (refresh git branch on thread resume), then PR #13457 (cache dynamic workspace on harness).


### Feature map PR #13456 and #13457

Processed PR [#13456](https://github.com/mastra-ai/mastra/pull/13456), `babdfb23c2` (`feat(mastracode): refresh git branch on thread resume & abbreviate long branch names (#13456)`). Verified current source refreshes the Git branch in `getDynamicInstructions()`, on `thread_changed`, and on agent start/end so resumed threads and branch-changing tool calls do not leave the prompt or TUI footer stale. `status-line.ts` now falls back from full path+branch to branch-only, abbreviated branch, then no directory.

Processed PR [#13457](https://github.com/mastra-ai/mastra/pull/13457), `00f43e8e97` (`fix: cache dynamic workspace on harness after resolution (#13457)`). Verified current core Harness caches dynamic workspace factory results in `buildRequestContext()` and exposes `resolveWorkspace()` for eager command usage. `/skills` and `/skill/<name>` call `resolveWorkspace()` when `getResolvedWorkspace()` has not been populated yet, so skills can be listed before the first message.

Documentation actions:

- Created `features/git/branch-context.md` for live branch prompt/status behavior and missing branch-refresh tests.
- Created `features/integrations/skills-command.md` for `/skills`, `/skill/<name>`, and Harness dynamic workspace resolution.
- Updated `features/chat/prompt-context.md`, `features/tui/interactive-chat.md`, and `features/integrations/harness-api.md` with #13456/#13457 relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13456 done, #13457 done, #13460 current.

Next queue checkpoint: PR #13460 (fdPath file autocomplete), then PR #13442 (Stop/UserPromptSubmit hooks).


### Feature map PR #13460 and #13442

Processed PR [#13460](https://github.com/mastra-ai/mastra/pull/13460), `e9cc208c94` (`fix(mastracode): wire fdPath to enable @ file autocomplete (#13460)`). Verified current source detects `fd` then `fdfind` with `which`/`where`, passes the resolved path as the third `CombinedAutocompleteProvider` argument, and preserves slash/custom/skill autocomplete provider setup. Current tests cover slash/skill autocomplete ordering but do not prove `fdPath` propagation.

Processed PR [#13442](https://github.com/mastra-ai/mastra/pull/13442), `cc62d1b2bb` (`mastracode: trigger Stop and UserPromptSubmit hooks in TUI (#13442)`). Verified current TUI runs `UserPromptSubmit` for non-command initial and interactive prompts before sending, removes optimistic messages when blocked, and runs `Stop` on `agent_end` reasons `complete`, `aborted`, and `error`. Also verified dynamic tool hooks still wrap `PreToolUse` / `PostToolUse` in `agents/tools.ts`.

Documentation actions:

- Created `features/tui/file-autocomplete.md` for `@` file references and `fd`/`fdfind` detection.
- Created `features/integrations/lifecycle-hooks.md` for hook config, blocking semantics, TUI lifecycle wiring, and tool hook wrapping.
- Updated `features/tui/interactive-chat.md`, `features/integrations/skills-command.md`, and `features/tools/coding-tools-permissions.md` with #13460/#13442 relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13460 done, #13442 done, #13487 current.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/tools.test.ts --reporter=dot` passed (4 tests).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/setup-keyboard-shortcuts.test.ts --reporter=dot --bail 1` failed on the known stale `/github` autocomplete expectation (`sync` now appears before `debug`).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-hooks.test.ts src/agents/tools.test.ts --reporter=dot` could not execute the hooks file because its `node:child_process` mock omits `execFile`, now imported via GitHub command wiring.
- An accidental broad `pnpm --filter ./mastracode test -- --run ...` reproduced the existing 5 failed files / 6 failed tests baseline; no code changes were made in this batch.

Next queue checkpoint: PR #13487 (terminal color theme), then PR #13494 (supported providers doc link).


### Feature map PR #13487 and #13494

Processed PR [#13487](https://github.com/mastra-ai/mastra/pull/13487), `9ef0b440ed` (`feat(mastracode): inherit terminal color theme for light/dark mode support (#13487)`). Verified current source resolves theme at startup from `MASTRA_THEME`, persisted `settings.preferences.theme`, OSC 11 terminal background detection, `COLORFGBG`, then dark fallback. `applyThemeMode()` switches dark/light palettes, computes contrast-adapted brand/surface colors, writes OSC 10 foreground color for unstyled text, and `restoreTerminalForeground()` resets it on exit.

Processed PR [#13494](https://github.com/mastra-ai/mastra/pull/13494), `5c6bf27b79` (`fix(mastracode): Update documentation link for supported providers`). Verified current onboarding provider warning points to `https://mastra.ai/models` for supported providers/API key env vars.

Documentation actions:

- Created `features/tui/terminal-theme.md` for `/theme`, auto-detection, global theme state, contrast utilities, and terminal OSC side effects.
- Updated `features/settings/onboarding-and-global-settings.md` with theme preference ownership and the supported-provider docs-link fix.
- Updated `features/tui/interactive-chat.md`, `features/tui/help-and-shortcuts.md`, `features/README.md`, and `_pr-queue.md` status markers: #13487 done, #13494 done, #13493 current.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/theme-contrast.test.ts src/onboarding/__tests__/settings.test.ts src/onboarding/__tests__/packs.test.ts --reporter=dot` passed (3 files / 68 tests).

Next queue checkpoint: PR #13493 (append unused slash-command args), then PR #13500 (allow onboarding with API keys only).


### Feature map PR #13493 and #13500

Processed PR [#13493](https://github.com/mastra-ai/mastra/pull/13493), `434ad50157` (`fix(mastracode): append unused arguments to slash command output (#13493)`). Verified current `processSlashCommand()` appends raw user args as an `ARGUMENTS:` block only when the template has no `$ARGUMENTS` or `$1+` placeholders, and does the append after shell/file expansion so raw args are not executed. The current regex treats `$0` as literal shell/prose text, not a positional placeholder.

Processed PR [#13500](https://github.com/mastra-ai/mastra/pull/13500), `47cb0a8962` (`fix(mastracode): allow onboarding to proceed with API keys only (#13500)`). Verified current onboarding computes `hasProviderAccess` from the full provider-access object, passes it into `OnboardingInlineComponent`, and shows API-key/OAuth copy instead of blocking users who have API keys but no OAuth login or built-in pack.

Documentation actions:

- Updated `features/chat/queued-followups.md` for custom slash-command argument preservation and missing `$0`/append tests.
- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` for API-key-only onboarding access.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13493 done, #13500 done, #13503 current.

Next queue checkpoint: PR #13503 (theme export startup crash), then PR #13505 (Claude Max OAuth ToS warning).


### Feature map PR #13503 and #13505

Processed PR [#13503](https://github.com/mastra-ai/mastra/pull/13503), `cc26bff512` (`fix(mastracode): remove individual theme function exports to fix startup crash (#13503)`). Verified current `theme.ts` keeps `fg`, `bg`, `bold`, `italic`, `dim`, `getTheme`, and `setTheme` as internal helpers exposed through the exported `theme` object. `tui/index.ts` exports `theme` and mode/palette helpers, but not the direct styling functions that caused the original startup crash.

Processed PR [#13505](https://github.com/mastra-ai/mastra/pull/13505), `11def4789e` (`feat(mastracode): add Claude Max OAuth ToS warning (#13505)`). Verified the original warning flow no longer exists in current source: no `claude-max-warning` files remain, `/login` and onboarding go straight through auth-mode selection + login dialog, and `CHANGELOG.md` records later #14605 removing the Anthropic OAuth warning prompt/settings.

Documentation actions:

- Updated `features/tui/terminal-theme.md` for the verified single `theme` object helper API and startup-crash regression risk.
- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` to record the historical Claude Max OAuth warning and current removal.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13503 done, #13505 done, #13476 current.

Next queue checkpoint: PR #13476 (OM buffering precision), then PR #13490 (Codex reasoning effort).


### Feature map PR #13476 and #13490

Processed PR [#13476](https://github.com/mastra-ai/mastra/pull/13476), `cb9f921320` (`fix: observational memory buffering precision (#13476)`). Verified current OM runtime and storage keep retained-context safeguards for buffered activation, interpret `blockAfter` as a threshold multiplier below 100 and absolute count at/above 100, trigger mid-step activation when buffered thresholds are crossed, and disable async buffering for resource scope in Mastra Code defaults.

Processed PR [#13490](https://github.com/mastra-ai/mastra/pull/13490), `d7ad237020` (`feat(mastracode): wire reasoning effort for OpenAI Codex models (#13490)`). Verified current OpenAI Codex provider maps thinking levels to `reasoningEffort`, enforces a minimum `low` level for GPT-5 Codex when requested `off`, and `/think` supports direct args, status, and an inline selector.

Documentation actions:

- Updated `features/memory/observational-memory.md` with #13476 activation precision, mid-step activation, storage-adapter sync risks, and current Mastra Code defaults.
- Created `features/models/thinking-and-reasoning.md` for `/think`, `--thinking-level`, Codex provider mapping, and OpenAI pack auto-enable behavior.
- Updated `features/models/model-auth-and-modes.md`, `features/README.md`, and `_pr-queue.md` status markers: #13476 done, #13490 done, #13508 current.

Verification:

- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/mid-loop-observation.test.ts --reporter=dot --bail 1` passed (7 tests).
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts --reporter=dot --bail 1 -t "blockAfter|buffered activation|activation"` passed (56 selected tests).
- `pnpm --filter ./mastracode exec vitest run src/__tests__/codex-model-routing.test.ts src/headless.test.ts --reporter=dot --bail 1` passed (49 tests).
- Targeted `model.test.ts` Codex cases passed after unsetting leaked API-key env vars; broad `model.test.ts -t "Codex|OpenAI|thinking"` still hits the known env-leak failure in `getOpenAIApiKey`.

Next queue checkpoint: PR #13508 (Claude Max OAuth warning strengthening), then PR #13455 (likely version-package skip).


### Feature map PR #13508 and #13455

Processed PR [#13508](https://github.com/mastra-ai/mastra/pull/13508), `089b114eb9` (`fix(mastracode): strengthen Claude Max OAuth risk warning`). Verified the PR only strengthened the warning copy added by #13505: it changed `CLAUDE_MAX_OAUTH_WARNING_MESSAGE` and docs text to mention reported bans and Terms of Service risk. Current source no longer has the warning module or modal flow because #14605 removed it; login/setup now proceed through auth-mode selection and the login dialog.

Processed PR [#13455](https://github.com/mastra-ai/mastra/pull/13455), `6302b3ae7c` (`chore: version packages (alpha)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json` under Mastra Code, so it is a version-package skip.

Documentation actions:

- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` with #13508 as historical warning-copy strengthening that is no longer active at HEAD.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13508 done, #13455 skipped, #13519 current.

Verification:

- `gh pr view 13508 --json number,title,body,author,mergedAt,url,files,commits` and `git show 089b114e...` verified the warning-copy-only diff.
- Current source search verified `auth/claude-max-warning.ts` is gone and `/login` no longer gates Anthropic OAuth on a Claude Max warning.
- `gh pr view 13455 --json number,title,body,author,mergedAt,url,files,commits` and `git show 6302b3ae7c -- mastracode` verified the version-only skip.

Next queue checkpoint: PR #13519 (tool approval resume for standalone agents), then PR #13525 (Mastra Code docs move).


### Feature map PR #13519 and #13525

Processed PR [#13519](https://github.com/mastra-ai/mastra/pull/13519), `b03c0e0389` (`fix: tool approval resume failing for standalone agents`). Verified the current core fix has two parts: `Harness.init()` creates an internal Mastra instance with configured storage and adds standalone agents to it, and workflow snapshot persistence serializes request context through `serializeRequestContext()` so functions/circular runtime objects do not break JSON persistence.

Processed PR [#13525](https://github.com/mastra-ai/mastra/pull/13525), `439dd1a1c9` (`chore(docs): Move Mastra Code docs, add Alpha notice to Harness`). Verified main-site Mastra Code docs were redirected to `https://code.mastra.ai/`, the Harness reference sidebar is Alpha-badged, and `mastracode/README.md` points users at the standalone Code docs site.

Documentation actions:

- Updated `features/integrations/harness-api.md` with #13519 internal Mastra/storage registration, request-context serialization, approval resume tests, #13525 docs redirects, and Alpha Harness docs status.
- Updated `features/tools/coding-tools-permissions.md` with #13519 approval-resume snapshot ownership, tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13519 done, #13525 done, #13530 current.

Verification:

- Current source checked: `packages/core/src/harness/harness.ts`, `packages/core/src/workflows/default.test.ts`, `packages/core/src/agent/__tests__/tool-approval-standalone-repro.test.ts`, `docs/vercel.json`, and `mastracode/README.md`.
- Focused tests planned for commit verification: core standalone approval resume, workflow request-context serialization, and MC LibSQL approval resume.

Next queue checkpoint: PR #13530 (Mastra Code docs move follow-up), then PR #13512 (models pack UX).


### Feature map PR #13530 and #13512

Processed PR [#13530](https://github.com/mastra-ai/mastra/pull/13530), `0533de8a34` (`chore(docs): Move mastra-code docs (#13530)`). Verified this was a documentation-location follow-up: Mastra Code docs moved from the temporary `mastracode/docs/` directory into `docs/src/mastra-code/`; current HEAD no longer has `mastracode/docs/`, and the product README points to the standalone Code docs site.

Processed PR [#13512](https://github.com/mastra-ai/mastra/pull/13512), `191e5bd29b` (`fix: unify /models pack flow and improve custom pack editing UX (#13512)`). Verified current `/models` opens the pack selector directly, `/models:pack` is intentionally unknown, custom pack actions include activate/edit/delete/share/import, targeted edit preserves untouched mode models, rename/delete clean up stale pack IDs, and model use counts are persisted through Harness `switchModel()` for selector sorting.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for the unified `/models` flow, custom pack CRUD/import/share behavior, model use-count ownership, and reload risks around stale pack IDs.
- Updated `features/settings/onboarding-and-global-settings.md` for #13512 custom-pack settings ownership and missing real-overlay tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13530 done, #13512 done, #13526 current.

Verification:

- Current source checked: `mastracode/src/tui/commands/models-pack.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/tui/components/model-selector.ts`, `mastracode/src/tui/__tests__/command-dispatch.test.ts`, and `mastracode/VERIFICATION.md`.
- Current tests checked: `mastracode/src/tui/commands/__tests__/models-pack.test.ts` and `mastracode/src/onboarding/__tests__/settings.test.ts`.

Next queue checkpoint: PR #13526 (edit tool path resolution), then PR #13557 (persist approved plans to disk).


### Feature map PR #13526 and #13557

Processed PR [#13526](https://github.com/mastra-ai/mastra/pull/13526), `85b54c0a4f` (`fix(mastracode): resolve edit tool paths like execute_command`). Verified the original Mastra Code-local edit tools were later replaced by core workspace tools, and current behavior is owned by `LocalFilesystem` / workspace tool wrappers: absolute paths inside the base path are allowed, absolute paths outside are blocked, and absolute-looking project paths such as `/src/app.ts` get a concrete relative-path hint only when that hint is safe.

Processed PR [#13557](https://github.com/mastra-ai/mastra/pull/13557), `15f4da196c` (`feat(plans): persist approved plans to disk`). Verified `handlePlanApproval()` saves approved plans best-effort through `savePlanToDisk()` before resolving approval; files are written as timestamped Markdown under app data `plans/<resourceId>/` or `MASTRA_PLANS_DIR`, with slug fallback to `untitled`.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13526 path-resolution ownership, current core workspace key files/tests, and path-semantics risk.
- Updated `features/goals/plan-approval.md` with #13557 approved-plan file persistence behavior, state ownership, key files, tests, and risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13526 done, #13557 done, #13560 current.

Verification:

- Current source checked: `packages/core/src/workspace/filesystem/local-filesystem.ts`, `packages/core/src/workspace/filesystem/local-filesystem.test.ts`, `packages/core/src/workspace/tools/edit-file.ts`, `packages/core/src/workspace/tools/ast-edit.ts`, `packages/core/src/workspace/tools/tools.ts`, `mastracode/src/tui/handlers/prompts.ts`, `mastracode/src/utils/plans.ts`, `mastracode/src/utils/__tests__/save-plan.test.ts`, and plan-persistence docs in `mastracode/README.md` / `docs/src/mastra-code`.
- PR metadata checked with `gh pr view 13526 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13557 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./packages/core test -- --run src/workspace/filesystem/local-filesystem.test.ts src/workspace/tools/__tests__/edit-file.test.ts --reporter=dot --bail 1` (2 files / 131 tests) and `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/save-plan.test.ts --reporter=dot --bail 1` (1 file / 6 tests).
- Accidental `pnpm --filter ./mastracode test -- --run src/utils/__tests__/save-plan.test.ts --reporter=dot --bail 1` expanded to the full package suite and reproduced the known 5 failing files / 6 failing tests baseline.

Next queue checkpoint: PR #13560 (non-fatal `ERR_STREAM_DESTROYED`), then PR #13563 (Codex OM/stream compatibility).


### Feature map PR #13560 and #13563

Processed PR [#13560](https://github.com/mastra-ai/mastra/pull/13560), `3b56d782fa` (`fix: handle ERR_STREAM_DESTROYED as non-fatal in global error handlers`). Verified `main.ts` ignores `ERR_STREAM_DESTROYED` in both `uncaughtException` and `unhandledRejection` handlers, while `error-classification.ts` keeps matching narrow by walking bounded cause chains and `AggregateError.errors`.

Processed PR [#13563](https://github.com/mastra-ai/mastra/pull/13563), `9311c17d7a` (`fix: make Codex models work with OM and mastracode streams`). Verified current source passes request context and abort signals through observer/reflector streams, resolves OM observer/reflector models with Codex OAuth remapping enabled, shapes Codex provider options for reasoning/tool use, and aborts the active harness stream on OM observation/buffering failures.

Documentation actions:

- Updated `features/setup/installation-and-launch.md` with #13560 global error classification behavior and tests.
- Updated `features/memory/observational-memory.md` with #13563 Codex-aware OM model routing, request-context propagation, and OM failure abort behavior.
- Updated `features/models/thinking-and-reasoning.md` with #13563 Codex middleware/OM compatibility notes.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13560 done, #13563 done, #13564 current.

Verification:

- Current source checked: `mastracode/src/main.ts`, `mastracode/src/error-classification.ts`, `mastracode/src/__tests__/stream-destroyed-error.test.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/agents/memory.ts`, `mastracode/src/providers/openai-codex.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/om-failure-abort.test.ts`, and `packages/memory/src/processors/observational-memory/{observer-runner.ts,reflector-runner.ts,observational-memory.ts}`.
- Current tests checked: `packages/memory/src/processors/observational-memory/__tests__/abort-signal.test.ts`, `packages/core/src/harness/om-failure-abort.test.ts`, `mastracode/src/__tests__/codex-model-routing.test.ts`, and `mastracode/src/__tests__/stream-destroyed-error.test.ts`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/__tests__/stream-destroyed-error.test.ts src/__tests__/codex-model-routing.test.ts --reporter=dot --bail 1` (2 files / 20 tests), `pnpm --filter ./packages/core test -- --run src/harness/om-failure-abort.test.ts --reporter=dot --bail 1` (1 file / 2 tests), and `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/abort-signal.test.ts --reporter=dot --bail 1` (1 file / 5 tests).

Next queue checkpoint: PR #13564 (extraTools wiring), then PR #13566 (model API-key detection).


### Feature map PR #13564 and #13566

Processed PR [#13564](https://github.com/mastra-ai/mastra/pull/13564), `675a6d717f` (`fix(mastracode): wire extraTools into tool builder and filter denied tools (#13564)`). Verified `createDynamicTools()` now receives config `extraTools`, supports record or request-context function forms, refuses to let extra tools overwrite built-ins, applies disabled-tool and per-tool deny filtering, and passes `deniedTools` into prompt guidance so runtime and instructions stay aligned.

Processed PR [#13566](https://github.com/mastra-ai/mastra/pull/13566), `dd32e1e7a2` (`fix(mastracode): detect API keys for all registry providers in setup flow (#13566)`). Verified startup and runtime provider access now scan registry `apiKeyEnvVar` entries instead of only the original hardcoded providers, so API-key-only providers such as Groq/Mistral can satisfy setup/model access checks.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13564 extraTools ownership, denied-tool prompt/runtime filtering, and merge-order risks.
- Updated `features/models/model-auth-and-modes.md` and `features/settings/onboarding-and-global-settings.md` with #13566 provider-registry API-key detection and missing non-hardcoded-provider tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13564 done, #13566 done, #13598 current.

Verification:

- Current source checked: `mastracode/src/agents/tools.ts`, `mastracode/src/agents/prompts/tool-guidance.ts`, `mastracode/src/agents/prompts/index.ts`, `mastracode/src/agents/extra-tools.test.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/commands/models-pack.ts`, `mastracode/src/onboarding/packs.ts`, and `mastracode/src/onboarding/onboarding-inline.ts`.
- PR metadata checked with `gh pr view 13564 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13566 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/agents/extra-tools.test.ts src/onboarding/__tests__/packs.test.ts src/tui/commands/__tests__/models-pack.test.ts --reporter=dot --bail 1` (3 files / 39 tests).

Next queue checkpoint: PR #13598 (rejected-plan visibility), then PR #13600 (Anthropic API-key fallback).


### Feature map PR #13598 and #13600

Processed PR [#13598](https://github.com/mastra-ai/mastra/pull/13598), `e37c95493f` (`fix: keep submitted plan visible when requesting changes (#13598)`). Verified `PlanApprovalInlineComponent.switchToFeedbackMode()` now clears and rebuilds the inline card with the plan header and plan content before showing the feedback input, so users can reference the submitted plan while requesting changes.

Processed PR [#13600](https://github.com/mastra-ai/mastra/pull/13600), `43187ad783` (`feat(mastracode): support Anthropic API key as fallback auth for model resolution (#13600)`). Verified current `resolveModel()` prefers explicit Anthropic OAuth, then stored/env Anthropic API key, then falls back to the OAuth provider prompt path; docs now describe OAuth as primary and API keys as fallback.

Documentation actions:

- Updated `features/goals/plan-approval.md` with #13598 feedback-mode plan retention, state ownership, tests, and mode-rebuild risk.
- Updated `features/models/model-auth-and-modes.md` with #13600 Anthropic auth priority, API-key fallback ownership, tests, and priority-drift risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13598 done, #13600 done, #13556 current.

Verification:

- Current source checked: `mastracode/src/tui/components/plan-approval-inline.ts`, `mastracode/src/tui/components/__tests__/plan-approval-inline.test.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/agents/__tests__/model.test.ts`, `mastracode/src/providers/claude-max.ts`, and `mastracode/README.md`.
- PR metadata checked with `gh pr view 13598 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13600 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed with env API keys unset: `env -u MASTRA_GATEWAY_API_KEY -u ANTHROPIC_API_KEY -u OPENAI_API_KEY pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/plan-approval-inline.test.ts src/agents/__tests__/model.test.ts --reporter=dot --bail 1` (2 files / 41 tests).

Next queue checkpoint: PR #13556 (Quiet mode), then PR #13609 (assistant text preservation + web-search fallback).


### Feature map PR #13556 and #13609

Processed PR [#13556](https://github.com/mastra-ai/mastra/pull/13556), `c6c5376cb2` (`feat: add Quiet mode setting for subagent output collapse (#13556)`). Verified current source has persisted `settings.preferences.quietMode`, `quietModeMaxToolPreviewLines`, and `onboarding.quietModePreferenceSelected`; startup copies those settings into `TUIState`; `/settings` exposes Quiet mode plus preview-line choices; live and loaded-history tool renderers apply compact quiet display. Current source appears later-polished versus the original #13556 wording: subagents receive `expandOnComplete: state.quietMode`, while the settings copy still mentions completed subagent collapse.

Processed PR [#13609](https://github.com/mastra-ai/mastra/pull/13609), `ebab49855b` (`fix: preserve assistant text after tool updates and add openai web_search fallback (#13609)`). Verified `handleMessageUpdate()` and `handleMessageEnd()` only update the streaming assistant component when trailing post-boundary content exists (or final abort/error state needs rendering), avoiding blanking previous assistant text after tool-result-only chunks. Verified `createDynamicTools()` adds OpenAI native `web_search` via `createOpenAI({}).tools.webSearch()` when Tavily is absent and the current model starts with `openai/`.

Documentation actions:

- Added `features/tui/quiet-mode.md` covering Quiet mode settings, rollout state, compact tool/task/subagent rendering, tests, and current behavior risks.
- Updated `features/tui/interactive-chat.md` with #13609 assistant streaming text preservation.
- Updated `features/tools/coding-tools-permissions.md` with #13609 OpenAI native web-search fallback and prompt-guidance parity risk.
- Updated `features/subagents/delegation.md`, `features/tools/task-tracking.md`, `features/settings/onboarding-and-global-settings.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13556 done, #13609 done, #13574 current.

Verification:

- Current source checked: `mastracode/src/onboarding/settings.ts`, `mastracode/src/tui/components/settings.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/handlers/tool.ts`, `mastracode/src/tui/render-messages.ts`, `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/components/subagent-execution.ts`, `mastracode/src/tui/handlers/message.ts`, and `mastracode/src/agents/tools.ts`.
- Tests identified/read: `mastracode/src/onboarding/__tests__/settings.test.ts`, `mastracode/src/tui/components/__tests__/subagent-execution.test.ts`, `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `mastracode/src/tui/handlers/__tests__/message.test.ts`, and `mastracode/src/agents/tools.test.ts`.
- PR metadata checked with `gh pr view 13556 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13609 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/onboarding/__tests__/settings.test.ts src/tui/components/__tests__/subagent-execution.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts src/tui/handlers/__tests__/message.test.ts src/agents/tools.test.ts --reporter=dot --bail 1` (5 files / 120 tests).

Next queue checkpoint: PR #13574 (file attachments), then PR #13605 (`/fix-issue` and `/report-issue`).


### Feature map PR #13574 and #13605

Processed PR [#13574](https://github.com/mastra-ai/mastra/pull/13574), `276246e0b9` (`feat(harness): file attachment support with filename preservation and text file handling`). Verified current Harness API accepts `sendMessage({ content, files })`, converts text/json attachments into filename-labeled fenced text, preserves binary file parts with `mediaType`/`filename`, and rehydrates persisted file/image content through signal and message-list adapters. Current adapter behavior: AIV4 emits file parts through `experimental_attachments`; AIV5 normalizes URL/data-URI file parts and avoids duplicate legacy attachment output.

Processed PR [#13605](https://github.com/mastra-ai/mastra/pull/13605), `829a09641d` (`feat(mastracode): add /fix-issue and /report-issue commands`). Verified current HEAD only exposes `/report-issue`; `/fix-issue` was removed by commit `079d9d4914` inside the same PR. `/report-issue` gates on model selection, creates a thread when `pendingNewThread` is true, injects a guided issue-reporting prompt, instructs duplicate search through `gh issue list` / `gh search issues`, requires user approval before `gh issue create`, and uses the `mastra-ai/mastra` repo plus `mastracode` label.

Documentation actions:

- Added `features/chat/file-attachments.md` for Harness attachment input, filename preservation, adapter conversion, and missing direct Harness tests.
- Added `features/integrations/github-issue-reporting.md` for `/report-issue`, stale `/fix-issue` title mismatch, GitHub CLI side effects, and prompt-driven approval risk.
- Updated `features/README.md`, `_pr-queue.md`, `tui/help-and-shortcuts.md`, `tui/interactive-chat.md`, `chat/prompt-context.md`, `chat/queued-followups.md`, `tools/coding-tools-permissions.md`, `handoff.md`, and this history entry. Queue status: #13574 done, #13605 done, #13437 current.

Verification:

- Current source checked: `packages/core/src/harness/harness.ts`, `packages/core/src/harness/types.ts`, `packages/core/src/agent/message-list/adapters/AIV4Adapter.ts`, `packages/core/src/agent/message-list/adapters/AIV5Adapter.ts`, `packages/core/src/agent/__tests__/agent-signals.test.ts`, `packages/core/src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts`, `packages/core/src/agent/message-list/prompt/attachments-to-parts.test.ts`, `mastracode/src/tui/commands/report-issue.ts`, `mastracode/src/tui/command-dispatch.ts`, `mastracode/src/tui/setup.ts`, and `mastracode/src/tui/components/help-overlay.ts`.
- PR metadata checked with `gh pr view 13574 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13605 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts src/agent/message-list/prompt/attachments-to-parts.test.ts --reporter=dot --bail 1` (3 files / 94 tests).
- Focused Mastra Code tests passed: `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts src/tui/components/__tests__/help-overlay.test.ts --reporter=dot --bail 1` (2 files / 26 tests).

Next queue checkpoint: PR #13437 (workspace tools with TUI streaming), then PR #13682 (`/custom-providers`).


### Feature map PR #13437 and #13682

Processed PR [#13437](https://github.com/mastra-ai/mastra/pull/13437), `e9476527fd` (`feat(mastracode): switch to workspace tools with TUI streaming [COR-511]`). Verified current source has file/list/search/edit/write/LSP/shell/process tools supplied by core `Workspace` rather than `createDynamicTools()`. `getDynamicWorkspace()` builds `Workspace` with `LocalFilesystem`, `LocalSandbox`, skill/allowed paths, plan-mode write-tool disabling, LSP config from settings plus package-runner detection, and reusable workspace IDs keyed by canonical project path. MC dynamic tools now only add non-workspace tools like `request_access`, notification inbox, web search/extract, MCP, extraTools, and hook wrappers. TUI renderer has workspace-specific output handling for view previews, tree summaries, edit diagnostics, and LSP diagnostics.

Processed PR [#13682](https://github.com/mastra-ai/mastra/pull/13682), `ee9c8df644` (`feat(mastracode): add /custom-providers command for custom OpenAI-compatible providers`). Verified `/custom-providers` modal CRUD at HEAD: provider name/url/API key, model add/remove, edit/delete, duplicate prevention, URL validation, and immediate manage view after create. Settings parsing trims/sanitizes entries, strips duplicate provider prefixes from model names, and persists optional API keys. `resolveModel()` routes custom provider IDs through `ModelRouterLanguageModel` before gateway/built-in logic, so custom provider collisions intentionally win. Harness `customModelCatalogProvider` adds custom models to `listAvailableModels()` for `/models` and `/om` selectors.

Documentation actions:

- Added `features/tools/workspace-tools.md` for core Workspace-backed coding tools, workspace caching, plan-mode tool disabling, LSP config, TUI streaming/rendering, and missing integration tests.
- Added `features/models/custom-providers.md` for `/custom-providers`, settings persistence, model routing/catalog integration, and missing modal/catalog tests.
- Updated `features/README.md`, `_pr-queue.md`, `tools/coding-tools-permissions.md`, `tools/streaming-tool-arguments.md`, `integrations/skills-command.md`, `models/model-auth-and-modes.md`, `settings/onboarding-and-global-settings.md`, `tui/help-and-shortcuts.md`, `handoff.md`, and this history entry. Queue status: #13437 done, #13682 done, #13690 current.

Verification:

- Current source checked: `mastracode/src/agents/workspace.ts`, `mastracode/src/agents/tools.ts`, `mastracode/src/tool-names.ts`, `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/commands/custom-providers.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/index.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/types.ts`, and `packages/core/src/workspace/tools/*`.
- Tests identified/read: `packages/core/src/harness/workspace-resolution.test.ts`, `packages/core/src/harness/subagent-workspace-integration.test.ts`, `packages/core/src/workspace/tools/__tests__/*.test.ts`, `mastracode/src/agents/__tests__/workspace-env.test.ts`, `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `mastracode/src/tui/commands/__tests__/custom-providers.test.ts`, `mastracode/src/onboarding/__tests__/settings.test.ts`, `mastracode/src/agents/__tests__/model.test.ts`, and `mastracode/src/tui/__tests__/command-dispatch.test.ts`.
- PR metadata checked with `gh pr view 13437 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13682 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused MC tests: first run including `src/agents/__tests__/model.test.ts` reproduced the known env-sensitive failure (`resolveModel > openai/* models > uses model router when no OpenAI auth is configured`, expected `model-router`, got `openai-direct` because OpenAI auth is present). Rerun excluding that known failure passed: `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/custom-providers.test.ts src/onboarding/__tests__/settings.test.ts src/tui/__tests__/command-dispatch.test.ts src/agents/__tests__/workspace-env.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --reporter=dot --bail 1` (5 files / 112 tests).
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/workspace-resolution.test.ts src/harness/subagent-workspace-integration.test.ts src/workspace/tools/__tests__/read-file.test.ts src/workspace/tools/__tests__/list-files.test.ts src/workspace/tools/__tests__/execute-command.test.ts src/workspace/tools/__tests__/edit-file.test.ts src/workspace/tools/__tests__/lsp-inspect.test.ts --reporter=dot --bail 1` (7 files / 117 tests).

Next queue checkpoint: PR #13690 (Harness resource ID methods and `/resource`), then PR #13613 (HTTP MCP servers).


### Feature map PR #13690 and #13613

Processed PR [#13690](https://github.com/mastra-ai/mastra/pull/13690), `f77cd94c44` (`fix: implement Harness resource ID methods and improve /resource command`). Verified current source exposes Harness `getResourceId()`, `setResourceId()`, `getDefaultResourceId()`, and `getKnownResourceIds()`; `/resource` displays current/default/known IDs, switches resource scope, resumes the latest thread for that resource, or marks `pendingNewThread` when none exist. Headless mode supports `--resource-id` for non-TUI scoping.

Processed PR [#13613](https://github.com/mastra-ai/mastra/pull/13613), `bf7ee23532` (`feat(mastracode): support HTTP MCP servers in config`). Verified current MCP config accepts stdio `command` entries and HTTP `url` entries, static `headers`, and validated OAuth metadata. Manager builds `MCPClient` server defs with `URL`, `requestInit`, optional `MCPOAuthClientProvider`, transport-aware statuses, skipped-server reasons, reload/reconnect, namespaced tools, and app-data OAuth token storage.

Documentation actions:

- Added `features/threads/resource-id-switching.md` for `/resource`, headless `--resource-id`, Harness resource helpers, latest-thread resume, pending-new-thread path, and missing loaded-history/resource-switch tests.
- Added `features/integrations/mcp-server-configuration.md` for stdio/HTTP MCP config, merge precedence, OAuth/static headers, manager state ownership, and missing real HTTP/OAuth integration tests.
- Updated `features/README.md`, `_pr-queue.md`, `threads/persistent-conversations.md`, `integrations/mcp-status-command.md`, `tools/coding-tools-permissions.md`, `tui/help-and-shortcuts.md`, `handoff.md`, and this history entry. Queue status: #13690 done, #13613 done, #13691 current.

Verification:

- Current source checked: `mastracode/src/tui/commands/resource.ts`, `mastracode/src/tui/commands/__tests__/resource.test.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/resource-id.test.ts`, `mastracode/src/headless.ts`, `mastracode/src/mcp/config.ts`, `mastracode/src/mcp/types.ts`, `mastracode/src/mcp/manager.ts`, `mastracode/src/mcp/__tests__/config.test.ts`, `mastracode/src/mcp/__tests__/manager.test.ts`, `mastracode/src/tui/commands/mcp.ts`, and `mastracode/src/main.ts`.
- PR metadata checked with `gh pr view 13690 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13613 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/resource.test.ts src/mcp/__tests__/config.test.ts src/mcp/__tests__/manager.test.ts src/tui/__tests__/command-dispatch.test.ts src/headless.test.ts --reporter=dot --bail 1` (5 files / 138 tests).
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/resource-id.test.ts --reporter=dot --bail 1` (1 file / 6 tests).

Next queue checkpoint: PR #13691 (debug.log env/size), then PR #13687 (workspace tool name remapping).


### Feature map batch: debug logging and workspace tool remapping

Processed PR [#13691](https://github.com/mastra-ai/mastra/pull/13691), `978a63d71e` (`fix(mastracode): gate debug.log behind MASTRA_DEBUG env var and cap file size`):

- Verified `mastracode/src/utils/debug-log.ts`: `setupDebugLogging()` only writes `getAppDataDir()/debug.log` when `MASTRA_DEBUG` is `true` or `1`; otherwise `console.error`/`console.warn` become no-ops to avoid corrupting the TUI.
- Verified `truncateLogFile()` caps existing logs over 5 MB by retaining roughly the last 4 MB and trimming to a newline boundary.
- Verified tests in `mastracode/src/utils/__tests__/debug-log.test.ts` cover default/false suppression, true/1 file logging, stack trace formatting, missing files, and size truncation.
- Created `.plan/mastracode-testing-recovery/features/tui/debug-logging.md` and cross-linked launch/TUI cards.

Processed PR [#13687](https://github.com/mastra-ai/mastra/pull/13687), `85664e9fd8` (`feat(workspace): support tool name remapping in workspace tools config`):

- Verified `WorkspaceToolConfig.name` in `packages/core/src/workspace/tools/types.ts` and `createWorkspaceTools()` in `tools.ts`: remapped tools register under the custom exposed dictionary key, update `tool.id`, and throw on duplicate exposed names.
- Verified `packages/core/src/workspace/tools/__tests__/tool-creation.test.ts` coverage for remapped filesystem/sandbox tools, preserved config options, ID updates, default-name preservation, and duplicate-name errors.
- Verified Mastra Code `TOOL_NAME_OVERRIDES` / `MC_TOOLS` usage across permissions, prompt guidance, subagent allowlists, validation errors, and `ToolExecutionComponentEnhanced` special cases.
- Updated workspace tools, coding tool permissions, README index, queue, and handoff. Queue now points at row 85 (#13569) as current.


### Feature map batch: OM clone on fork and test contamination cleanup

Processed PR [#13569](https://github.com/mastra-ai/mastra/pull/13569), `b8963791c6` (`feat(memory): clone Observational Memory when forking threads`). Verified current `Memory.cloneThread()` clones thread-scoped OM after the storage-domain thread/message clone, remaps `observedMessageIds`, deprecated `bufferedMessageIds`, and `bufferedObservationChunks[*].messageIds` through `messageIdMap`, resets transient observing/buffering flags, and rolls back the already-persisted clone if OM cloning fails before vector embedding. Resource-scoped OM is shared when the resource ID is unchanged and cloned with xxhash thread-tag remapping when the clone targets a new resource.

Processed PR [#13692](https://github.com/mastra-ai/mastra/pull/13692), `87ab58f1c5` (`fix(mastracode): fix test failures from cross-test contamination and add temp dir gitignore`). Verified current affected tests use `vi.hoisted(() => vi.resetModules())` to avoid isolate:false module-cache contamination in `model.test.ts` and command dispatch tests, and `.gitignore` covers `.test-tmp/` for interrupted local test output.

Documentation actions:

- Updated `features/memory/observational-memory.md` with OM clone/fork behavior, source-of-truth ownership, key clone files, `clone-thread-om.test.ts`, and storage-backed integration gaps.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13569 done, #13692 done, #13701 current.

Verification:

- Current source checked: `packages/memory/src/index.ts`, `packages/memory/src/clone-thread-om.test.ts`, `packages/core/src/storage/domains/memory/inmemory.ts`, `mastracode/src/agents/__tests__/model.test.ts`, `.gitignore`, and related feature-map pages.
- Focused memory test passed: `pnpm --filter ./packages/memory exec vitest run src/clone-thread-om.test.ts --reporter=dot --bail 1` (1 file / 11 tests).
- Focused MC tests passed with provider env vars unset: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1` (2 files / 56 tests). The first run without env isolation hit the known local `OPENAI_API_KEY` routing mismatch in `model.test.ts`.

Next queue checkpoint: PR #13701 (separate TUI debug env var), then PR #13693 (set workspace).


### Feature map batch: TUI debug env split and custom workspace config

Processed PR [#13701](https://github.com/mastra-ai/mastra/pull/13701), `33f289c616` (`use separate tui debug env var`). Verified `mastracode/src/tui/components/assistant-message.ts` now gates assistant-message component trace output behind `MASTRA_TUI_DEBUG` while global console warning/error capture remains controlled by `MASTRA_DEBUG` in `utils/debug-log.ts`.

Processed PR [#13693](https://github.com/mastra-ai/mastra/pull/13693), `6e1b940177` (`feat(mc): set workspace`). Verified `MastraCodeConfig.workspace` and current `createMastraCode()` choose `config?.workspace ?? getDynamicWorkspace`, then pass that same workspace into both `HarnessV1` and `HarnessCompat`. Default dynamic workspace behavior remains unchanged when no override is provided.

Documentation actions:

- Updated `features/tui/debug-logging.md` with `MASTRA_TUI_DEBUG`, `tui-debug.log`, and the separation from app-data `debug.log`.
- Updated `features/tools/workspace-tools.md` with the public `createMastraCode({ workspace })` override, fallback behavior, state ownership, and missing config-level tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13701 done, #13693 done, #13700 current.

Verification:

- Current source checked: `mastracode/src/tui/components/assistant-message.ts`, `mastracode/src/utils/debug-log.ts`, `mastracode/src/index.ts`, `mastracode/src/agents/workspace.ts`, `packages/core/src/harness/workspace-resolution.test.ts`, and related feature-map pages.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/debug-log.test.ts src/index.test.ts src/agents/__tests__/workspace-env.test.ts src/agents/__tests__/build-skill-paths.test.ts src/agents/__tests__/workspace-skill-activation.test.ts --reporter=dot --bail 1` (5 files / 20 tests).
- Focused core test passed: `pnpm --filter ./packages/core exec vitest run src/harness/workspace-resolution.test.ts --reporter=dot --bail 1` (1 file / 12 tests, no type errors).

Next queue checkpoint: PR #13700 (forward requestContext and skill paths to subagents), then PR #13710 (README follow-ups).


### Feature map batch: subagent request context and template README follow-ups

Processed PR [#13700](https://github.com/mastra-ai/mastra/pull/13700), `1c4221cf60` (`fix: forward requestContext and skill paths to subagents`). Verified current core `createSubagentTool()` forwards a copied `RequestContext` into `subagentToRun.stream()`. Non-forked subagents preserve harness state but strip parent `threadId`/`resourceId`; forked subagents retarget inherited tools to the cloned thread/resource. Verified Mastra Code `getAllowedPathsFromContext()` now merges computed skill paths from `buildSkillPaths(projectPath, configDir)` with `sandboxAllowedPaths`, so delegated agents can access the same skill directories and user-approved external paths as the parent.

Processed PR [#13710](https://github.com/mastra-ai/mastra/pull/13710), `bc2665ebf3` (`chore(templates): README follow-ups`). Verified this is template README copy cleanup only; no Mastra Code runtime feature card was needed.

Documentation actions:

- Updated `features/subagents/delegation.md` with request-context copy/retarget behavior, inherited filesystem access, test coverage, and leakage risk.
- Updated `features/tools/workspace-tools.md` with subagent skill/sandbox path inheritance and `getAllowedPathsFromContext()` coverage.
- Updated `features/integrations/skills-command.md` with skill-path inheritance for delegated agents.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13700 done, #13710 done, #13713 current.

Verification:

- Current source checked: `packages/core/src/harness/tools.ts`, `packages/core/src/harness/subagent-tool.test.ts`, `mastracode/src/agents/workspace.ts`, `mastracode/src/tools/utils.ts`, `mastracode/src/tools/__tests__/get-allowed-paths.test.ts`, and related feature-map pages.
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/subagent-tool.test.ts src/harness/subagent-workspace-integration.test.ts --reporter=dot --bail 1` (2 files / 29 tests, no type errors).
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/tools/__tests__/get-allowed-paths.test.ts src/agents/__tests__/build-skill-paths.test.ts src/agents/__tests__/workspace-skill-activation.test.ts --reporter=dot --bail 1` (3 files / 17 tests).

Next queue checkpoint: PR #13713 (dynamic extraTools functions), then PR #13712 (Ctrl+V clipboard paste).


### Feature map batch: dynamic extraTools functions and clipboard paste

Processed PR [#13713](https://github.com/mastra-ai/mastra/pull/13713), `d7ed2bb64e` (`feat(mastracode): support dynamic extraTools functions`). Verified current `createDynamicTools()` accepts either a static extra-tools record or a function that receives `{ requestContext }`, resolves the tools per request, then applies the existing no-overwrite guard plus disabled/denied filtering.

Processed PR [#13712](https://github.com/mastra-ai/mastra/pull/13712), `d365d2926b` (`feat(cli): Add clipboard image and text paste support via Ctrl+V`). Verified `CustomEditor` maps Ctrl+V / Alt+V to explicit clipboard paste: image clipboard data calls `onImagePaste` when present; text clipboard data is wrapped in bracketed-paste markers and sent through the existing paste pipeline. Also verified bracketed paste still handles empty image pastes, local image paths/file URLs, and remote image URLs. Current source did not show a production `onImagePaste` assignment, so the feature map records that as an integration gap.

Documentation actions:

- Created `features/tui/clipboard-paste.md` for editor clipboard text/image paste behavior and platform helper risks.
- Updated `features/tools/coding-tools-permissions.md` with request-context-aware extraTools function behavior.
- Updated `features/tui/interactive-chat.md`, `features/tui/help-and-shortcuts.md`, and `features/chat/file-attachments.md` with Ctrl+V/Alt+V and attachment-pipeline links.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13713 done, #13712 done, #13716 current.

Verification:

- Current source checked: `mastracode/src/agents/tools.ts`, `mastracode/src/agents/extra-tools.test.ts`, `mastracode/src/clipboard/index.ts`, `mastracode/src/clipboard/__tests__/index.test.ts`, `mastracode/src/tui/components/custom-editor.ts`, `mastracode/src/tui/components/__tests__/custom-editor.test.ts`, and related feature-map pages.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/agents/extra-tools.test.ts src/clipboard/__tests__/index.test.ts src/tui/components/__tests__/custom-editor.test.ts --reporter=dot --bail 1` (3 files / 38 tests).

Next queue checkpoint: PR #13716 (export `resolveModel`), then PR #13603 (auto-update prompt on session start).

### Feature map batch: resolveModel export and auto-update prompts

Processed PR [#13716](https://github.com/mastra-ai/mastra/pull/13716), `ee8de2adcf` (`feat(mastracode): export resolveModel from createMastraCode`). Verified current `createMastraCode()` returns `resolveModel` alongside Harness/TUI dependencies so external consumers can resolve model IDs through the same configured provider registry, custom-provider routing, gateway/OAuth/API-key fallback, and request-context-aware resolver path used by Mastra Code itself.

Processed PR [#13603](https://github.com/mastra-ai/mastra/pull/13603), `548da794ec` (`feat(mastracode): auto-update prompt on session start`). Verified current startup update checks use `utils/update-check.ts` for current/latest version detection, package-manager-specific install commands, semver comparison, changelog fetch/parse, and update execution. `MastraTUI` triggers an initial non-passive check after startup work and schedules passive rechecks every 45 minutes; declining persists `settings.updateDismissedVersion` so the same version is not repeatedly prompted.

Documentation actions:

- Created `features/setup/auto-update-prompts.md` for startup update checks, dismissed-version persistence, package-manager install command selection, and test gaps.
- Updated `features/setup/installation-and-launch.md` with the startup update prompt link.
- Updated `features/models/model-auth-and-modes.md` and `features/integrations/harness-api.md` with the exported `resolveModel` surface.
- Updated `features/settings/onboarding-and-global-settings.md` with `updateDismissedVersion` ownership.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13716 done, #13603 done, #13696 current.

Verification:

- Current source checked: `mastracode/src/index.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/utils/update-check.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/commands/update.ts`, `mastracode/src/onboarding/settings.ts`, and related feature-map pages.
- Focused tests passed: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u DEEPSEEK_API_KEY pnpm --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts src/tui/commands/__tests__/update.test.ts src/index.test.ts src/agents/__tests__/model.test.ts --reporter=dot --bail 1` (3 files / 50 tests). First run without env isolation hit the known local `OPENAI_API_KEY` routing mismatch in `model.test.ts`.

Next queue checkpoint: PR #13696 (queue parallel interactive tool calls), then PR #13724 (workspace gitignore support, lower tree depth, and tool guidance).

### Feature map batch: queued interactive prompts and gitignore-aware workspace tools

Processed PR [#13696](https://github.com/mastra-ai/mastra/pull/13696), `6f2946f240` (`fix(mastracode): queue parallel interactive tool calls to prevent input corruption`). Verified current TUI prompt handling serializes concurrent inline `ask_user` and sandbox access prompts through `TUIState.pendingInlineQuestions`. The first prompt stays active in `activeInlineQuestion`; later activations wait until submit/cancel calls `processNextInlineQuestion()`. Ctrl+C/Escape and process SIGINT cleanup clear both `activeInlineQuestion` and `pendingInlineQuestions` before aborting Harness so queued prompts do not appear after abort.

Processed PR [#13724](https://github.com/mastra-ai/mastra/pull/13724), `77b4a254e5` (`feat(workspace): gitignore support, lower tree depth, fix tool guidance`). Verified current core Workspace tools load workspace-root `.gitignore` via `loadGitignore()`. `find_files` defaults `maxDepth` to 2 and `respectGitignore` to true; `search_content` skips gitignored paths during recursive walks, while still allowing explicitly targeted ignored directories. Tool guidance now tells agents that `find_files` and `search_content` respect `.gitignore` by default.

Documentation actions:

- Created `features/tui/interactive-prompts.md` for queued inline question/access-request behavior and abort cleanup.
- Updated `features/tui/interactive-chat.md` with #13696 queue ownership and links.
- Updated `features/tools/workspace-tools.md` with `.gitignore` filtering, default depth, explicit ignored-target bypass, and tests.
- Updated `features/tools/coding-tools-permissions.md` with prompt queueing and gitignore-aware guidance.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13696 done, #13724 done, #13723 current.

Verification:

- Current source checked: `mastracode/src/tui/handlers/prompts.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts`, `packages/core/src/workspace/gitignore.ts`, `packages/core/src/workspace/tools/list-files.ts`, `grep.ts`, `tree-formatter.ts`, related workspace tool tests, and `mastracode/src/agents/prompts/tool-guidance.ts`.
- Focused tests passed: MC prompt/extra-tools tests (2 files / 27 tests) and core workspace list/search/tree tests (3 files / 99 tests, no type errors).

Next queue checkpoint: PR #13723 (Ctrl+Z suspend), then PR #13523 (likely version-package skip).

### Feature map batch: process suspend shortcut and version-package skip

Processed PR [#13723](https://github.com/mastra-ai/mastra/pull/13723), `52022c842c` (`feat(mastracode): Ctrl+Z now suspends the process (SIGTSTP)`). Verified current TUI editor routing maps Ctrl+Z to a `suspend` action and Alt+Z to the prior undo-last-clear action. `setupKeyboardShortcuts()` stops the UI, registers a one-shot `SIGCONT` handler, sends `SIGTSTP` to the current process, and restarts/render-refreshes the UI on continuation. Windows is guarded with an info message, and signal failure removes the listener, restarts UI, requests render, and shows an error. Alt+Z restores `TUIState.lastClearedText` only when the editor is empty.

Reviewed PR [#13523](https://github.com/mastra-ai/mastra/pull/13523), `edfda994ef` (`chore: version packages (alpha)`). This is a version-package batch. Relevant MastraCode/core touched files are only `CHANGELOG.md` and `package.json` updates, so it is recorded as a skip and no behavior feature page was created.

Documentation actions:

- Created `features/tui/process-suspend.md` for Ctrl+Z suspend / Alt+Z undo behavior, state ownership, risks, and test gaps.
- Updated `features/tui/help-and-shortcuts.md` with Ctrl+Z/Alt+Z shortcut semantics.
- Updated `features/tui/interactive-chat.md` with process suspend as part of editor/setup lifecycle.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13723 done, #13523 skipped, #13760 current.

Verification:

- Current source checked: `mastracode/src/tui/components/custom-editor.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/components/help-overlay.ts`, `mastracode/src/tui/components/settings.ts`, `mastracode/src/tui/components/__tests__/custom-editor.test.ts`, `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts`, and PR #13523 changed-file list.
- Focused tests passed for direct editor/help coverage: `custom-editor.test.ts` and `help-overlay.test.ts` (2 files / 22 tests). Broader shortcut setup run also included `setup-keyboard-shortcuts.test.ts` but hit the known stale /github autocomplete drift: expected `subscribe, unsubscribe, debug`, received `subscribe, unsubscribe, sync, debug`.

Next queue checkpoint: PR #13760 (inline version at build time), then PR #13761 (likely version-package skip).
