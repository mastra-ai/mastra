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

Feature map structure has been tightened, the first 4 baseline pages have been shrunk to concise cards, and PRs #13227-#13344 have been processed, with #13037, #13251, #13252, and #13257 recorded as version-package skips. `_pr-queue.md` has a Status column for follow-along state. Next checkpoint: #13345 (`7aedfb7ff9`, `feat(tui): resolve autocomplete and queue slash commands on Ctrl+F (#13345)`), then #13311 (`d1b596fb05`, `fix(mastracode): wire mcpManager to TUI so /mcp command works (#13311)`).

## Blockers

None known.

## Next steps

1. Continue at `_pr-queue.md` row 25: PR #13345 (Ctrl+F autocomplete/queued slash commands), then row 26: PR #13311 (`/mcp` manager wiring).
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
- Current batch is doc-only; no product tests were run.
