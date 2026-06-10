# Git branch context and status

## Origin PR / commit

- PR: [#13456](https://github.com/mastra-ai/mastra/pull/13456) — refresh current Git branch in prompt context and TUI status after thread resume or branch changes.
- Later changes: [#16790](https://github.com/mastra-ai/mastra/pull/16790) — makes Git branch refresh async so slash-command/active-run paths do not block the TUI while refreshing branch status.

## User-visible behavior

- What the user can do: switch Git branches outside or inside Mastra Code and expect the footer plus next agent prompt to use the current branch.
- Success looks like: thread resume and new runs show the live branch, not the branch captured at startup, and branch refresh does not block active-run slash-command or status redraw paths.
- Must preserve: long branch names should abbreviate before the status footer drops branch context entirely.

## Entry points / commands

- Commands / shortcuts / flags: no direct command; affected by thread switching, message sends, and any tool/shell command that changes branches.
- Automatic triggers: `getDynamicInstructions()`, `thread_changed`, `agent_start`, and `agent_end` branch refreshes.

## TUI states

- Idle: status footer displays project path plus branch, branch-only, abbreviated branch, or no branch depending on width.
- Active / modal / error: branch refresh is async and should not block streaming or modal cleanup.

## Headless / non-TUI behavior

- Supported: headless prompt context uses `getDynamicInstructions()` and refreshes branch before building the system prompt.
- Not supported / unknown: no status footer; branch visibility depends on prompt logging/test hooks.

## Streaming / loading / interrupted states

- Streaming / loading: branch is refreshed at run start; tools that switch branches during a turn are reflected at `agent_end`.
- Abort / retry / resume: retry/new run rebuilds prompt context from current branch; thread resume refreshes TUI footer after history render.

## Streaming vs loaded-from-history behavior

- While actively streaming: prompt context uses branch captured before that run; footer may refresh again at run end.
- After reload / history reconstruction: `thread_changed` and the next prompt use the current working tree branch, not a historical branch saved with the thread.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current branch | `git rev-parse --abbrev-ref HEAD` via project utilities | Prompt context, TUI status footer |
| Cached project info | `TUIState.projectInfo` | Status line and branch refresh callbacks |
| Prompt branch | Harness request context + live git refresh | Base prompt Environment section |

## Key files

- `mastracode/src/utils/project.ts` — `getCurrentGitBranch()` and async variant.
- `mastracode/src/agents/instructions.ts` — refreshes branch for every dynamic prompt build.
- `mastracode/src/tui/event-dispatch.ts` — refreshes branch on `thread_changed`.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — refreshes branch on `agent_start` and `agent_end`.
- `mastracode/src/tui/status-line.ts` — branch/path layout fallback and long-branch abbreviation.

## Dependencies / related features

- [Prompt context](../chat/prompt-context.md) — branch is part of the system prompt Environment section.
- [Interactive chat](../tui/interactive-chat.md) — status footer renders branch context.
- [Persistent conversations](../threads/persistent-conversations.md) — thread resume must not preserve stale branch display.

## Existing tests

- `mastracode/src/tui/__tests__/status-line.test.ts` verifies long branches use the stable abbreviated footer form before path truncation can drop branch context.
- `mastracode/scripts/mc-e2e/scenarios/branch-context-long-name.ts` starts real Mastra Code in a temp git repo and verifies both startup branch context and footer abbreviation.
- Existing TUI handler/status tests indirectly exercise branch-refresh/render wiring but not every live git refresh trigger.

## Missing tests

- Thread switch/reload while on a different branch refreshes footer and prompt branch.
- Tool/shell branch switch during a run updates footer at `agent_end`.
- Detached HEAD and non-git directories keep explicit graceful behavior coverage.

## Known risks / regressions

- Async branch refresh can race with status redraws, so the footer may briefly show stale branch text.
- Prompt and footer can still diverge if git lookup fails in one path and falls back to cached state.
- Long-branch footer regression is now covered: lossy path truncation, wrong abbreviation shape, and disabled abbreviation were all break-validated.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

## TUI e2e recovery evidence

- Covered by checked-in `branch-context-long-name` scenario: starts in a temp git repo, asserts startup branch context, and verifies abbreviated footer branch rendering.
- Verification: full e2e `--jobs 2`, check, lint, and build passed in the state/startup batch.
