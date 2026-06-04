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

Feature map structure has been tightened, the first 4 baseline pages have been shrunk to concise cards, and PRs #13227-#13239 have been processed. Next PR in queue: #13245 (`6fdd3d451a`, `Harness primitive (#13245)`).

## Blockers

None known.

## Next steps

1. Continue at `_pr-queue.md` row 6: PR #13245.
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
- Current batch is doc-only; no product tests were run.
