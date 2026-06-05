# Mastra Code testing recovery handoff

## Current status

Planning/research in progress.

## Finished

- Created the planning index.
- Started the progress history.
- Moved prior architecture/test audit artifacts under `explorations/mastracode-testing-recovery/architecture-review/`.
- Researched AIMock and wrote `explorations/mastracode-testing-recovery/aimock-exploration.md`.
- Recorded the feature-map structure and template under `.plan/mastracode-testing-recovery/features/`.
- Restored `mastracode-testing-recovery` as a normal protocol skill.
- Added `.mastracode/commands/map-mc-features.md`; use `/goal/map-mc-features [optional scope]` to build the feature map from PR history.
- Generated `.plan/mastracode-testing-recovery/features/_pr-queue.md` from squash-merged `mastracode/` history.
- Partially processed PR #13218 as the foundation batch and wrote baseline feature pages for interactive chat, persistent conversations, model auth/modes, and coding tools/permissions.

## Active work

Feature map structure has been tightened, the first 4 baseline pages have been shrunk to concise cards, and queue rows through #15653 (row 226) have been processed, with #13037, #13251, #13252, #13257, #13260, #13405, #13455, #13523, #13761, #13766, #14062, #13883, #14102, #14146, #14147, #14167, #14201, #14266, #14280, #14343, #14427, #14439, #14518, #14549, #14654, #14656, #14870, #14904, #14911, #14929, #14965, #15034, #15042, #15055, #15059, #15083, #15114, #15117, #15165, #15172, #15174, #15190, #15191, #15200, #15390, #15403, #15544, #15515, #15601, #15606, #15629, and #15653 recorded as version/dependency skips plus #12532, #14260, #13933, and #14432 recorded as build/CI/dependency-only for the Mastra Code feature map. `_pr-queue.md` has a Status column for follow-along state. Next checkpoint: row 227 #15678 (custom slash commands remain active-thread scoped).

## Blockers

None known.

## Next steps

1. Continue at `_pr-queue.md` row 227: PR #15678 (custom slash commands remain active-thread scoped), then row 228 #15656 (Changesets alpha skip) and row 230 #15749 (per-thread state clearing follow-up).
2. For each PR, verify with `gh pr view <number>` and current source/tests before editing pages.
3. Update existing cards in place when later PRs modify behavior from #13218.
4. Keep new pages concise and add/update the source-of-truth table in `features/README.md`.
5. Commit/push in reviewable chunks after each meaningful batch.

## Files to read first

- `.claude/skills/mastracode-testing-recovery/SKILL.md`
- `.mastracode/commands/map-mc-features.md`
- `.plan/mastracode-testing-recovery/README.md`
- `.plan/mastracode-testing-recovery/history.md`
- `.plan/mastracode-testing-recovery/handoff.md`
- `.plan/mastracode-testing-recovery/features/README.md`
- `.plan/mastracode-testing-recovery/features/_template.md`

## Last commands/evidence

- Rows 223-226 verified/documented: #15631 TUI status-line normalization for Fireworks/generic `p` model IDs, #15605 opt-in temporal-gap OM markers with Mastra Code defaults/rendering, and #15629/#15653 Changesets alpha skips. Focused verification passed: status-line normalization tests (4), memory temporal-marker tests (5), core temporalMarkers serialization test (1, no type errors), and MastraCode render-messages temporal-gap tests (3).
- Rows 219-222 verified/documented: #15448 standalone `@mastra/tavily` integration package plus Mastra Code web-search/web-extract wrapper delegation, and #15515/#15601/#15606 Changesets alpha skips. Focused verification passed: Tavily package tests (31), targeted MastraCode web-search renderer test (1), and MastraCode dynamic/extra-tools tests (23).
- Rows 215-218 verified/documented: #15403 Changesets alpha skip, #15423 headless `--output-format text|json|stream-json`, #15566 bounded/procedural ReDoS hardening for Mastra Code TUI parsers, OM tag stripping, and workspace/skill path normalization, and #15544 formatting/lint dependency skip. Focused verification passed: headless output-format unit tests (4), OM message-utils tests (6), core skill-versioning path-normalization tests (11, no type errors), and MastraCode ANSI/tool validation/enhanced renderer tests (75).
- Rows 211-214 verified/documented: #15420 observation activation on provider/model change, #15458 Anthropic built-in model-pack defaults (`claude-opus-4-7` / `claude-sonnet-4-6`), #15462 early reflection activation overshoot suppression and normalized provider-change comparison, and #15483 Anthropic/OpenAI provider stored-key fallback before env vars. Focused verification passed: memory provider-change/overshoot tests (20), MastraCode OM marker/pack/key fallback tests (17 with provider env isolated), targeted direct-key model tests (2), and core step-start/model metadata tests (9, no type errors).
- Rows 207-210 verified/documented: #15370 custom model-pack share/import via `mastra-pack:` payloads, #15390 Changesets alpha skip, #14909 headless `--model`/`--settings` preflight and precedence handling, and #15365 OM `activateAfterIdle` / `auto` provider-aware idle activation. Focused verification passed: MastraCode model-pack/headless unit tests (59), targeted headless `--model` integration tests (8), memory TTL/idle tests (13), core memory config tests (7, no type errors), MastraCode OM marker tests (5), and targeted OM activateAfterIdle API tests (10).
- Rows 204-206 verified/documented: #15352 autonomy-first/common-sense prompt refinement, #15359 opt-in caveman OM compression with thread/global persistence and base-prompt memory-style guard, and #15200 Changesets alpha skip. Focused verification passed: MastraCode prompt + thread-caveman tests (15) and targeted startup caveman restore tests (2).
- Rows 201-203 verified/documented: #15014 `/api-keys` provider key management command, #14435 `processAPIError`/`PrefillErrorHandler` retry path for assistant-prefill LLM API rejections, and #15194 browser profile/executablePath support. Focused verification passed: MastraCode command/help/settings tests (51), core prefill-error/runner recovery tests (92, no type errors), and core browser tests (18, no type errors).
- Rows 197-200 verified/documented: #15190/#15191 Changesets alpha skips, #15192 thread-boundary task/plan/access reset, and #15228 symlinked workspace skill alias resolution. Focused verification passed: MastraCode event-dispatch thread reset tests (11) and core workspace skill/filesystem symlink tests (386, no type errors).
- Rows 194-196 verified/documented: #15092 collapsible shell passthrough output, #15174 Changesets alpha skip, and #14962 headless thread control flags. Focused verification passed: shell/prune/headless unit tests (54), targeted Ctrl+E shortcut test (1), and targeted headless thread-control integration tests (5). Initial full setup-keyboard-shortcuts run hit the known unrelated GitHub autocomplete ordering assertion.
- Rows 190-193 verified/documented: #15151 Agent Skills spec directories and #15117/#15165/#15172 Changesets alpha skips. Focused verification passed: MastraCode skill-path/activation/allowed-paths/skills command tests (24 tests).
- Rows 186-189 verified/documented: #15036 browser automation support, #15088 subagent/prune review follow-ups, and #15083/#15114 Changesets alpha skips. Focused verification passed: core browser tests (18 tests) and MastraCode subagents/prune/help/dispatch tests (31 tests).
- Row 185 verified/documented: #15082 prunes old rendered TUI chat components on agent end/abort/error to cap long-session memory growth. Focused verification passed: `prune-chat.test.ts` (2 tests).
- Rows 180-184 verified/documented: #14965/#15034/#15042/#15055/#15059 are Changesets alpha package-version batches; skipped for feature mapping. No focused tests needed for skip-only docs.
- Rows 177-179 verified/documented: #14929 version-package skip, #14952 Mastra Gateway model router/provider memory integration, and #14936 masked sensitive TUI input fields.
- Focused verification for rows 177-179 passed: MastraCode model + memory-gateway command (40 tests with provider env isolated), core memory-gateway duck typing (1 test), and server memory handler (85 tests).
- Rows 174-176 verified/documented: #14911 version-package skip, #14960 seven-day MCP client timeout for long-running tool results, and #14961 base prompt guidance to use `request_access` for external-path access failures.
- Focused verification for rows 174-176 passed: MastraCode MCP manager tests and prompt tests.
- Rows 171-173 verified/documented: #14535 safe circular tool-result serialization plus #14870/#14904 version-package skips.
- Focused verification for rows 171-173 passed: core `utils.test.ts` (66 tests).
- Rows 168-170 verified/documented: #14656 version-package skip, #14867 gateway provider key quoting for digit-leading names, and #14804 configured subagents in `/subagents`.
- Focused verification for rows 168-170 passed: core registry generator (3 tests), MastraCode gateway sync wrapper + subagents command (10 tests).
- Rows 165-167 verified/documented: #14788 persisted OM threshold settings, #14790 capped dynamic instruction reminders, and #14845 custom responses for option prompts.
- Focused verification for rows 165-167 passed: core OM threshold persistence (2 tests), core `tool-result-reminder` (14 tests), and MastraCode ask-question inline tests (15 tests).
- Rows 162-164 verified/documented: #14637 dynamic nested instruction reminders, #14727 custom slash-command loading, and #14567 cross-thread recall/search/indexing plus `/thread` info.
- Focused verification for rows 162-164 passed: core `tool-result-reminder` (14 tests), MastraCode system-reminder/slash-loader/thread command (17 tests), and memory `om-tools` (91 tests).
- Rows 159-161 verified/documented: #14690 all-resource thread selector loading, #14691 removal of live thread-preview lookup, and #14565 `lsp_inspect` workspace tool/TUI renderer.
- Focused verification for rows 159-161 passed: `threads.test.ts` + `thread-selector.test.ts` (6 tests) and `lsp-inspect.test.ts` (13 tests).
- Rows 156-158 verified/documented: #14549/#14654 version-package skips and #14688 response guidance prompt placement/wording.
- Focused verification for rows 156-158 passed: `prompts.test.ts` (6 tests).
- Rows 153-155 verified/documented: #14586 macOS active-run `caffeinate` lifecycle, #14604 OpenAI built-in mode/OM pack defaults, #14605 Claude Max OAuth warning removal.
- Focused verification for rows 153-155 passed after a minimal test-mock fix: `mastra-tui-hooks.test.ts` (15 tests) and onboarding `packs/settings` tests (30 tests).
- Rows 150-152 verified/documented: #14541 dependency range pins, #14518 version-package skip, #14587 autonomous system prompts/model-specific prompt assembly.
- Focused verification for rows 150-152 passed: `prompts.test.ts` (6 tests).
- Rows 147-149 verified/documented: #14479 inline-question long-answer wrapping, #14439 version-package skip, #14437 OM retrieval/recall tooling.
- Focused verification for rows 147-149 passed: ask-question inline wrapping (3 tests), `om-tools.test.ts` (91 tests), and targeted OM anchor/group/retrieval slice (13 passed / 437 skipped).
- `git log --reverse --date=short --name-only --pretty=format:'...' -- mastracode` generated `_pr-queue.md`.
- `gh pr view 13218 --json number,title,body,author,mergedAt,baseRefName,headRefName,url` verified the initial port PR summary.
- `gh pr view 13227 --json number,title,body,author,mergedAt,url,files` verified PR #13227 intent/files.
- Read current `mastracode/src/agents/subagents/*.ts`, `agents/workspace.ts`, `tui/commands/subagents.ts`, and subagent tests before creating the subagents card.
- `gh pr view 13231 --json number,title,body,author,mergedAt,url,files` verified PR #13231 intent/files.
- Read current `mastracode/src/agents/memory.ts`, `tui/commands/om.ts`, `tui/handlers/om.ts`, `agents/tools.ts`, and OM/gateway tests before creating the memory card.
- `gh pr view 13234 --json number,title,body,author,mergedAt,url,files,commits` verified PR #13234 metadata; commit diff showed mostly structural/type/build cleanup.
- Read current `mastracode/src/agents/instructions.ts`, `agents/prompts/*`, `src/index.ts`, `src/main.ts`, and prompt/index tests before creating the prompt-context card.
- `gh pr view 13239 --json number,title,body,author,mergedAt,url,files,commits` verified PR #13239; representative diffs and current schema/tool references showed type/build stability only, so no feature page was created.
- `gh pr view 13245 --json number,title,body,author,mergedAt,url,files,commits` plus current `HarnessCompat`, `index.ts`, TUI dispatch/prompt handlers, and approval tests verified PR #13245. Existing TUI/thread/model/tool cards were updated; no runtime-layer Harness page was created.
- `gh pr view 13037` and `git show a0b5df263a -- mastracode` verified #13037 as Changesets alpha packaging only; skipped.
- `gh pr view 13250 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/src/lsp/client.ts` verified the ESM LSP import fix. Updated the tools card and missing packaged-startup test note.
- `gh pr view 13251` and `git show a20fbeff59 -- mastracode` verified #13251 as Changesets alpha packaging only; skipped.
- `gh pr view 13253 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/src/tools/*` and `packages/schema-compat/src/zod-to-json.ts` verified the Zod v3/v4 tool-schema compatibility fix. Updated the tools card and missing packaged/source schema test note.
- `gh pr view 13252` and `git show f090302af0 -- mastracode` verified #13252 as Changesets alpha packaging only; skipped.
- `gh pr view 13255 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/package.json`, `mastracode/tsup.config.ts`, and `mastracode/src/tui/index.ts` verified the public `mastracode/tui` export. Updated the TUI card and missing package-export smoke test note.
- `_pr-queue.md` now has a Status column through row 16 so progress is visible directly in the queue file.
- `gh pr view 13257` and `git show 834b03e500 -- mastracode` verified #13257 as Changesets alpha packaging only; skipped.
- `gh pr view 13305 --json number,title,body,author,mergedAt,url,files,commits`, current `mastracode/src/agents/memory.ts`, and core OM threshold/runtime/tests verified the OM activation safeguard changes. Updated the memory card and noted current MC defaults differ from the #13305 PR body.
- `gh pr view 13294 --json number,title,body,author,mergedAt,url,files,commits` plus current README/package/startup files verified install/launch docs. Created the setup install card.
- `gh pr view 13330 --json number,title,body,author,mergedAt,url,files,commits`, current `/om` callbacks, and core harness OM event tests verified streamed OM lifecycle/model-change event behavior. Updated the memory card.
- `gh pr view 13331 --json number,title,body,author,mergedAt,url,files,commits`, current `audit-tests.ts`, `index.ts`, and prompt guidance verified intended audit-tests behavior plus current registration gap. Created the audit-tests card.
- `gh pr view 13328 --json number,title,body,author,mergedAt,url,files,commits`, current core harness display-state code/tests, TUI tool handlers, and history renderer verified streaming tool arguments. Created the streaming-tool-arguments card.
- `gh pr view 13335 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/src/tui/handlers/tool.ts` verified task-tool input streaming preserves pre-tool assistant text. Updated the streaming-tool-arguments card.
- `gh pr view 13307 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/src/agents/model.ts` and `model.test.ts` verified AuthStorage reload before model resolution. Updated the model auth card.
- `gh pr view 13334 --json number,title,body,author,mergedAt,url,files,commits` plus current `mastracode/src/index.ts`, `utils/thread-lock.ts`, core Harness lock code, and `thread-locking.test.ts` verified optional thread lock config. Updated the threads card.
- `gh pr view 13339 --json number,title,body,author,mergedAt,url,files,commits` plus current `base.ts` and `tool-guidance.ts` verified subagent parallel-only guidance and current audit-tests exception inconsistency. Updated subagent cards.
- `gh pr view 13343 --json number,title,body,author,mergedAt,files,commits` plus current `mastracode/src/tui/setup.ts` verified worktree-aware startup auto-resume filtering by `metadata.projectPath` and legacy directory birthtime fallback. Updated the threads card.
- `gh pr view 13344 --json number,title,body,author,mergedAt,files,commits` plus current core task tools, TUI task handlers, event dispatch, prompt injection, permissions, and task tests verified the todo→task/core-Harness move. Created the task-tracking card and updated tool cards.
- `gh pr view 13345 --json number,title,body,author,mergedAt,body,files,commits`, current `custom-editor.ts`, `setup.ts`, `mastra-tui.ts`, `agent-lifecycle.ts`, and queueing/editor tests verified Ctrl+F autocomplete + queued slash-command behavior. Created the queued-followups card.
- `gh pr view 13311 --json number,title,body,author,mergedAt,body,files,commits`, current `main.ts`, `state.ts`, `mastra-tui.ts`, `commands/mcp.ts`, MCP manager tests, and command-dispatch tests verified `/mcp` manager wiring. Created the MCP status command card.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/components/__tests__/custom-editor.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1` (66 tests).
- `gh pr view 13346 --json number,title,body,author,mergedAt,url,files,commits`, `git show e399dcba4f -- mastracode`, current `agent-instructions.ts`, `prompts/index.ts`, `index.ts`, and prompt/headless tests verified plural `AGENTS.md` static instruction loading. Updated the prompt-context card.
- `gh pr view 13347 --json number,title,body,author,mergedAt,url,files,commits`, `git show 48d19d89e0 -- mastracode`, current `mcp/manager.ts`, `mcp/index.ts`, `agents/tools.ts`, `index.ts`, and MCP manager tests verified `createMcpManager()` factory refactor preserves manager/tool/status behavior. Updated MCP and tools cards.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/agents/__tests__/prompts.test.ts src/agents/prompts/index.test.ts src/mcp/__tests__/manager.test.ts --reporter=dot --bail 1` (52 tests).

- `gh pr view 13348 --json number,title,body,author,mergedAt,url,files,commits`, current `mastracode/src/tools/web-search.ts`, `packages/core/src/workspace/tools/output-helpers.ts`, and core output-helper tests verified 2k token result limits. Updated the tools card.
- `gh pr view 13349 --json number,title,body,author,mergedAt,url,files,commits`, current `mastracode/src/agents/memory.ts`, and `git blame` verified #13349's 4000-token threshold was temporary; current source is back to 2000 after later precision/scope work. Updated the OM card.

- `gh pr view 13350 --json number,title,body,author,mergedAt,url,files,commits`, current `mastracode/src/tui/state.ts`, `tui/index.ts`, and TUI tests verified `TUIState` / `createTUIState()` extraction and public export. Updated the interactive TUI card.
- `gh pr view 13355 --json number,title,body,author,mergedAt,url,files,commits`, the old `file-view.ts` patch, current core `read-file.ts` / `list-files.ts`, and workspace tool tests verified that literal `view_range` directory pagination was replaced by split core tools. Updated the tools card with current behavior and risk.

- `gh pr view 13354 --json number,title,body,author,mergedAt,url,files,commits`, current OM strategy/observer/storage files, and OM tests verified continuation hints and degenerate-output handling. Updated the OM card.
- `gh pr view 13353 --json number,title,body,author,mergedAt,url,files,commits`, current core Harness API, Mastra Code call sites, Harness docs, and harness tests verified object-param public API behavior. Created the Harness API feature card.

- `gh pr view 13260 --json number,title,body,author,mergedAt,url,files,commits` and `git show e610573a4c -- mastracode .changeset` verified #13260 as alpha package version/CHANGELOG/changelog-only churn; skipped.
- `gh pr view 13416 --json number,title,body,author,mergedAt,url,files,commits`, current Plan-mode prompt/tool-guidance files, core `submit_plan` tool, TUI plan handlers, history renderer, and tests verified plan approval/build handoff behavior. Created the plan approval feature card.
- `gh pr view 13413 --json number,title,body,author,mergedAt,url,files,commits`, current `mastracode/src/tui/mastra-tui.ts`, `event-dispatch.ts`, `handlers/*`, `render-messages.ts`, `setup.ts`, and handler/event tests verified TUI modularization as an internal refactor. Updated the interactive TUI card.
- `gh pr view 13385 --json number,title,body,author,mergedAt,url,files,commits`, current `packages/core/src/workspace/lsp/language.ts`, `manager.ts`, `tools/lsp-inspect.ts`, and legacy `mastracode/src/lsp/language.ts` verified TS/JS LSP language IDs are mapped, not raw extensions. Updated the tools card.
- `gh pr view 13384 --json number,title,body,author,mergedAt,url,files,commits`, original `file-view.ts` / `file-editor.ts` diff, current core `list-files.ts`, `tree-formatter.ts`, and `list-files.test.ts` verified hidden files are excluded by default and shown only with `showHidden`. Updated the tools card.
- `gh pr view 13376 --json number,title,body,author,mergedAt,url,files,commits`, current `instructions.ts`, `prompts/index.ts`, `prompts/base.ts`, and prompt/model-state tests verified model-aware `Co-Authored-By` guidance. Created the commit-attribution feature card.
- `gh pr view 13421 --json number,title,body,author,mergedAt,url,files,commits`, current onboarding/settings/model-pack source, and onboarding/model-pack tests verified first-run setup, settings persistence, and pack resolution. Created the onboarding/global settings feature card.
- `gh pr view 13431 --json number,title,body,author,mergedAt,url,files,commits`, current `auth/storage.ts`, `onboarding/packs.ts`, and `packs.test.ts` verified the Codex default change has since drifted; current OpenAI pack/login default is `openai/gpt-5.5`.
- `gh pr view 13422 --json number,title,body,author,mergedAt,url,files,commits`, current `banner.ts`, `setup.ts`, and `banner.test.ts` verified responsive startup banner behavior. Created the startup-banner feature card.
- `gh pr view 13428 --json number,title,body,author,mergedAt,url,files,commits`, current `tool-execution-enhanced.ts`, `workspace.ts`, `tool-names.ts`, and tool component tests verified workspace `read_file` output is rendered through the remapped `view` tool and arrow line numbers are stripped. Updated the tools card.
- `gh pr view 13426 --json number,title,body,author,mergedAt,url,files,commits`, current `help.ts`, `help-overlay.ts`, `setup.ts`, and help-overlay tests verified compact `/help` command/shortcut output. Created the help-and-shortcuts feature card.
- `gh pr view 13427 --json number,title,body,author,mergedAt,url,files,commits`, current core `HarnessDisplayState`, `display-state-scheduler.ts`, `harness.ts`, TUI display-state routing, and display-state tests verified UI-agnostic display-state behavior. Created the Harness display-state feature card.
- `gh pr view 13435 --json number,title,body,author,mergedAt,url,files,commits`, current `project.ts`, `storage-factory.ts`, settings UI/command files, and storage-config tests verified LibSQL/PostgreSQL backend resolution, fallback, and restart-required settings behavior. Created the storage-backend feature card.
- `gh pr view 13405 --json number,title,body,author,mergedAt,url,files,commits` and `git show 424bd890be -- mastracode .changeset` verified #13405 as alpha package version/CHANGELOG-only churn; skipped.
- `gh pr view 13456 --json body`, current branch refresh/status-line files, and prompt/TUI code verified live Git branch refresh and abbreviation behavior. Created the branch-context feature card.
- `gh pr view 13457 --json body`, current core Harness workspace methods/docs, `/skills` command, and workspace-resolution/skills tests verified dynamic workspace caching. Created the skills-command feature card.
- `gh pr view 13460 --json number,title,body,author,mergedAt,url,files,commits`, original setup diff, current `setup.ts`, README, and autocomplete tests verified `fd`/`fdfind` path detection for `@` file autocomplete. Created the file-autocomplete feature card.
- `gh pr view 13442 --json number,title,body,author,mergedAt,url,files,commits`, current hook manager/executor/config, TUI hook wiring, dynamic tool wrapper, and hook tests verified `UserPromptSubmit` and `Stop` lifecycle behavior. Created the lifecycle-hooks feature card.
- Focused verification for this batch: `src/agents/tools.test.ts` passed; `setup-keyboard-shortcuts.test.ts` still fails on the known stale `/github sync` autocomplete expectation; `mastra-tui-hooks.test.ts` is currently blocked by a test mock missing `execFile` after GitHub command imports.
- `gh pr view 13487 --json number,title,body,author,mergedAt,url,files,commits`, current `theme.ts`, `detect-theme.ts`, `/theme` command, startup theme resolution, and theme contrast tests verified terminal theme detection/contrast behavior. Created the terminal-theme feature card.
- `gh pr view 13494 --json number,title,body,author,mergedAt,url,files,commits` and current `onboarding-inline.ts` verified the supported-providers docs URL is now `https://mastra.ai/models`. Updated the onboarding/settings card.
- Focused verification for #13487/#13494: theme contrast + onboarding settings/packs tests passed (3 files / 68 tests).
- `gh pr view 13493 --json number,title,body,author,mergedAt,url,files,commits`, current `slash-command-processor.ts`, command loader, and setup autocomplete verified unused slash args are appended safely. Updated the queued-followups card.
- `gh pr view 13500 --json number,title,body,author,mergedAt,url,files,commits`, current onboarding/settings source, provider access resolution, and onboarding/settings tests verified API-key-only onboarding. Updated onboarding/model cards.
- `gh pr view 13503 --json number,title,body,author,mergedAt,url,files,commits`, current theme module exports and theme tests verified theme helper access through the `theme` object. Updated the terminal-theme card.
- `gh pr view 13505 --json number,title,body,author,mergedAt,url,files,commits`, current login/model source and changelog evidence verified the Claude Max OAuth warning was historical and later removed by #14605. Updated onboarding/model cards.
- `gh pr view 13476 --json number,title,body,author,mergedAt,url,files,commits`, current memory runtime/storage implementations, thresholds, token counter, and OM tests verified buffering precision and retained-context safeguards. Updated the observational-memory card.
- `gh pr view 13490 --json number,title,body,author,mergedAt,url,files,commits`, current Codex provider/model resolver, `/think` command, thinking settings, and model tests verified OpenAI Codex reasoning effort wiring. Created the thinking-and-reasoning feature card.
- `gh pr view 13508 --json number,title,body,author,mergedAt,url,files,commits` plus current login/source search verified the strengthened Claude Max OAuth warning is historical and no longer active. Updated onboarding/model cards.
- `gh pr view 13455 --json number,title,body,author,mergedAt,url,files,commits` and `git show 6302b3ae7c -- mastracode` verified the version-package skip.
- `gh pr view 13519 --json number,title,body,author,mergedAt,url,files,commits`, current core Harness/workflow source, and approval resume tests verified standalone/storage-backed tool approval resume. Updated Harness API and tools cards.
- `gh pr view 13525 --json number,title,body,author,mergedAt,url,files,commits`, docs redirects, Harness reference sidebar, and `mastracode/README.md` verified the main-site docs move and Alpha badge. Updated Harness API docs card.
- `gh pr view 13530 --json number,title,body,author,mergedAt,url,files,commits`, current `docs/src/mastra-code/`, and missing `mastracode/docs/` verified the docs-location follow-up. Updated model/settings docs only where #13512 changed behavior.
- `gh pr view 13512 --json number,title,body,author,mergedAt,url,files,commits`, current `models-pack.ts`, settings/model selector source, and model-pack/settings tests verified unified `/models` pack flow. Updated model/settings cards.
- `gh pr view 13526 --json number,title,body,author,mergedAt,url,files,commits`, current core workspace filesystem/tools source, and path-containment tests verified edit tool path resolution semantics. Updated tools card.
- `gh pr view 13557 --json number,title,body,author,mergedAt,url,files,commits`, current plan approval handler, `utils/plans.ts`, README/docs, and save-plan tests verified best-effort approved-plan persistence. Updated plan-approval card.
- Focused verification for #13526/#13557 passed: core local-filesystem/edit-file tests (2 files / 131 tests) and Mastra Code save-plan test (1 file / 6 tests). An accidental Mastra Code full-suite invocation reproduced the known 5-file baseline failures.
- `gh pr view 13560 --json number,title,body,author,mergedAt,url,files,commits`, current `main.ts`, `error-classification.ts`, and stream-destroyed tests verified non-fatal `ERR_STREAM_DESTROYED` handling. Updated install/launch card.
- `gh pr view 13563 --json number,title,body,author,mergedAt,url,files,commits`, current Codex provider/model/memory source, core Harness OM failure tests, and memory abort-signal tests verified Codex OM/stream compatibility. Updated OM and thinking cards.
- `gh pr view 13564 --json number,title,body,author,mergedAt,url,files,commits`, current `createDynamicTools()`, tool guidance, and extra-tools tests verified extraTools merge and denied-tool filtering. Updated tools card.
- `gh pr view 13566 --json number,title,body,author,mergedAt,url,files,commits`, current provider-registry startup/setup/model-pack source verified all-provider API-key access detection. Updated model/settings cards.
- Focused verification for #13564/#13566 passed: extra-tools, onboarding packs, and models-pack tests (3 files / 39 tests).
- `gh pr view 13598 --json number,title,body,author,mergedAt,url,files,commits`, current `PlanApprovalInlineComponent`, and plan approval inline tests verified request-changes mode keeps the plan visible while collecting feedback. Updated plan-approval card.
- `gh pr view 13600 --json number,title,body,author,mergedAt,url,files,commits`, current `resolveModel()`, `getAnthropicApiKey()`, Claude Max provider source, README docs, and model tests verified Anthropic OAuth priority with API-key fallback. Updated model-auth card.
- Focused verification for #13598/#13600 passed with env API keys unset: plan-approval-inline and model tests (2 files / 41 tests).
- `gh pr view 13556 --json number,title,body,author,mergedAt,url,files,commits`, current quiet-mode settings/source, subagent component, tool renderer, and tests verified quiet mode state. Added `features/tui/quiet-mode.md`; noted current source appears later-polished/superseded versus the original collapse wording.
- `gh pr view 13609 --json number,title,body,author,mergedAt,url,files,commits`, current message handler and dynamic tools verified assistant text preservation after tool-only chunks plus OpenAI native `web_search` fallback. Updated interactive-chat and coding-tools cards; noted prompt-guidance parity risk.
- Focused verification for #13556/#13609 passed: onboarding settings, subagent execution, tool execution enhanced, message handler, and dynamic tools tests (5 files / 120 tests).
- `gh pr view 13574 --json number,title,body,author,mergedAt,url,files,commits`, current Harness send/message-content paths, signal tests, and message-list adapter tests verified file attachment support. Added `features/chat/file-attachments.md`; noted missing direct Harness `sendMessage({ files })` test.
- `gh pr view 13605 --json number,title,body,author,mergedAt,url,files,commits`, current command dispatch/setup/help/report command source verified `/report-issue`; `/fix-issue` is absent at HEAD despite the PR title. Added `features/integrations/github-issue-reporting.md`; noted missing direct command prompt test.
- Focused verification for #13574/#13605 passed: core agent signals + AIV5 file adapter + attachment prompt tests (3 files / 94 tests), MC command-dispatch + help-overlay tests (2 files / 26 tests).
- `gh pr view 13437 --json number,title,body,author,mergedAt,url,files,commits`, current `getDynamicWorkspace()`, core workspace resolver/tests, workspace tool tests, and TUI tool renderer verified workspace-backed coding tools. Added `features/tools/workspace-tools.md`; noted plan-mode/reload integration gaps.
- `gh pr view 13682 --json number,title,body,author,mergedAt,url,files,commits`, current `/custom-providers` command, settings parser, model resolver, catalog provider, dispatch/help/setup wiring verified custom providers. Added `features/models/custom-providers.md`; noted modal-flow and Harness custom-catalog cache gaps.
- Focused verification for #13437/#13682: core workspace/harness slice passed (7 files / 117 tests); MC custom-provider/settings/dispatch/workspace-env/tool-renderer slice passed (5 files / 112 tests). Including `model.test.ts` reproduced the known env-sensitive OpenAI auth failure (expected model-router, got openai-direct), so it was excluded from the passing rerun.
- `gh pr view 13690 --json number,title,body,author,mergedAt,url,files,commits`, current `/resource` command, Harness resource ID helpers, headless args, and resource tests verified resource switching. Added `features/threads/resource-id-switching.md`; noted missing end-to-end loaded-history/resource-switch test.
- `gh pr view 13613 --json number,title,body,author,mergedAt,url,files,commits`, current MCP config/manager/types, command setup text, and tests verified HTTP MCP server config support. Added `features/integrations/mcp-server-configuration.md`; noted missing real HTTP MCP server integration and OAuth flow tests.
- Focused verification for #13690/#13613 passed: MC resource/MCP/headless/dispatch tests (5 files / 138 tests) and core resource ID tests (1 file / 6 tests).
- Rows 143-146 verified/documented: #14423 prompt/editor/history styling (current HEAD consolidated animation into `CustomEditor`/`GradientAnimator`), #14428 `/threads` preview cache/lazy loading, #14472 non-italic tool args, and #14436 OM-generated thread titles. Updated interactive chat, threads, streaming-tool-arguments, OM, index, queue, and history docs. Focused verification passed: MC TUI slice 4 files / 83 tests; memory OM thread-title slice 1 file / 5 tests.
