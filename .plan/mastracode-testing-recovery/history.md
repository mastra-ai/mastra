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
