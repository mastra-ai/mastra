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

Feature map structure has been tightened, the first 4 baseline pages have been shrunk to concise cards, and queue rows through #13557 (row 68) have been processed, with #13037, #13251, #13252, #13257, #13260, #13405, and #13455 recorded as version-package skips. `_pr-queue.md` has a Status column for follow-along state. Next checkpoint: #13560 (`3b56d782fa`, non-fatal ERR_STREAM_DESTROYED), then #13563 (`9311c17d7a`, Codex OM/stream compatibility).

## Blockers

None known.

## Next steps

1. Continue at `_pr-queue.md` row 69: PR #13560 (non-fatal `ERR_STREAM_DESTROYED`), then row 70: PR #13563 (Codex OM/stream compatibility).
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
