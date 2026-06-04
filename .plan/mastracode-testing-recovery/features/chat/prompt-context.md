# Prompt context and project instructions

## Origin PR / commit

- PR: [#13234](https://github.com/mastra-ai/mastra/pull/13234) — moved prompt building into agent prompt modules and added runtime instruction assembly.
- Later changes: task-list injection, model-specific prompt sections, goal-mode prompt guidance, and dynamic AGENTS.md injection changed this behavior later.

## User-visible behavior

- What the user can do: influence agent behavior through project/global instruction files and current runtime state.
- Success looks like: the agent sees the right project, branch, mode, model, tools, tasks, plan, and instructions for the current run.
- Must preserve: prompt context must match the active session, not stale history or another thread.

## Entry points / commands

- Commands / shortcuts / flags: no direct command; affected by `/mode`, `/models`, `/think`, `/permissions`, `/goal`, task tools, and plan approval.
- Automatic triggers: every agent run builds instructions through `getDynamicInstructions()`.

## TUI states

- Idle: prompt uses current harness state and project metadata when a run starts.
- Active / modal / error: active run should keep the prompt/context captured for that run.

## Headless / non-TUI behavior

- Supported: headless runs use the same dynamic instruction builder through the shared agent/runtime setup.
- Not supported / unknown: no UI to inspect final prompt; requires tests or tracing to verify exact prompt after reload.

## Streaming / loading / interrupted states

- Streaming / loading: model sees the assembled system prompt before streamed output begins.
- Abort / retry / resume: retry/new run should rebuild context from current state; interrupted partial output should not mutate prompt context.

## Streaming vs loaded-from-history behavior

- While actively streaming: prompt context comes from the active harness request context.
- After reload / history reconstruction: context depends on restored session/thread state plus current filesystem instruction files.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Mode/model | Harness session | Prompt mode/model sections, runtime model selection |
| Project metadata | Project detection + git utilities | Environment section |
| Task list | Harness state | `<current-task-list>` prompt section |
| Active plan | Harness state | Base/mode prompt guidance |
| Permission denies | Harness state permission rules | Tool guidance filtering |
| AGENTS/CLAUDE instructions | Filesystem + config dir | Agent instructions section, `AgentsMDInjector` |

## Key files

- `mastracode/src/agents/instructions.ts` — builds prompt context from harness request context.
- `mastracode/src/agents/prompts/index.ts` — assembles base, tasks, instructions, model, and mode sections.
- `mastracode/src/agents/prompts/base.ts` — shared environment and behavior prompt.
- `mastracode/src/agents/prompts/agent-instructions.ts` — loads AGENTS.md/CLAUDE.md instruction files.
- `mastracode/src/index.ts` — wires `getDynamicInstructions()` into the code agent.

## Dependencies / related features

- [Interactive chat](../tui/interactive-chat.md) — every chat run uses this prompt assembly.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected mode/model affects prompt sections.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — denied tools alter tool guidance.
- [Observational memory](../memory/observational-memory.md) — task prompt injection protects task state after memory truncation.

## Existing tests

- `mastracode/src/agents/__tests__/prompts.test.ts` — model-specific prompts, goal prompt guidance, common binary context.
- `mastracode/src/agents/prompts/index.test.ts` — task-list prompt injection and escaping.
- `mastracode/src/__tests__/index.test.ts` — verifies runtime wiring uses `getDynamicInstructions()`.
- `mastracode/src/headless-integration.test.ts` — includes AGENTS.md reminder persistence coverage.

## Missing tests

- Final prompt after thread reload preserves model/mode/task/plan state.
- Instruction file precedence across global/project/config-dir locations.
- Permission-denied tools disappear from prompt guidance in real runs.

## Known risks / regressions

- Prompt context can drift if harness state, thread metadata, and TUI footer disagree.
- Loaded-from-history runs can silently use current filesystem instructions, not the instructions that existed when history was created.
- Instruction injection exists both in prompt assembly and processors; duplicate or stale instruction paths need testing.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
