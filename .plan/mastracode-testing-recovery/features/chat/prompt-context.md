# Prompt context and project instructions

## Origin PR / commit

- PR: [#13234](https://github.com/mastra-ai/mastra/pull/13234) — moved prompt building into agent prompt modules and added runtime instruction assembly.
- Later changes: [#13346](https://github.com/mastra-ai/mastra/pull/13346) — static instruction discovery switched from dead `AGENT.md` to plural `AGENTS.md`; [#13416](https://github.com/mastra-ai/mastra/pull/13416) — split mode-aware tool guidance into `tool-guidance.ts` and made Plan mode explicitly require `submit_plan`; [#13376](https://github.com/mastra-ai/mastra/pull/13376) — passed current model ID into Git Safety commit attribution guidance; [#13456](https://github.com/mastra-ai/mastra/pull/13456) — refreshes current Git branch during dynamic instruction assembly; [#14587](https://github.com/mastra-ai/mastra/pull/14587) — expands base autonomy/common-sense guidance and inserts model-specific prompt sections during assembly; [#14688](https://github.com/mastra-ai/mastra/pull/14688) — moves Tone/Style to the end of the base prompt and tightens response guidance; [#14637](https://github.com/mastra-ai/mastra/pull/14637) — injects nearest nested `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` files as ephemeral system reminders after path-touching tool calls; [#14790](https://github.com/mastra-ai/mastra/pull/14790) — caps injected instruction reminders at about 1000 estimated tokens and adds truncation markers; task-list injection and goal-mode prompt guidance changed this behavior later.

## User-visible behavior

- What the user can do: influence agent behavior through project/global `AGENTS.md` or `CLAUDE.md` instruction files, nested path-specific instruction files loaded on demand, current runtime state, and selected model.
- Success looks like: the agent sees the right project, branch, mode, model, model-specific prompt guidance, tools, tasks, plan, static instructions, dynamically relevant nested instructions, and terminal-friendly response style for the current run without a large nested instruction file taking over the context window.
- Must preserve: `AGENTS.md` wins over `CLAUDE.md` at the same location; singular `AGENT.md` is not loaded as a static instruction file; dynamic reminders are ephemeral, capped, and deduped; model-specific sections only apply to matching model IDs; tone/style stays late in the base prompt so it remains salient.

## Entry points / commands

- Commands / shortcuts / flags: no direct command; affected by `/mode`, `/models`, `/think`, `/permissions`, `/goal`, task tools, and plan approval.
- Automatic triggers: every agent run builds instructions through `getDynamicInstructions()` and `buildFullPrompt()`.

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
| Mode/model | Harness session | Prompt mode/model sections, runtime model selection, commit attribution |
| Model-specific prompt text | `modelSpecificPrompts` keyed by selected model ID | `buildFullPrompt()` assembled system prompt |
| Base autonomy/tone guidance | `buildBasePrompt()`; Tone and Style intentionally appears near the end after work/git/message-delivery/file-access sections | Shared behavior instructions for all modes/models |
| Project metadata and branch | Project detection + live git branch refresh | Environment section |
| Task list | Harness state | `<current-task-list>` prompt section |
| Active plan | Harness state | Base/mode prompt guidance |
| Permission denies | Harness state permission rules | Tool guidance filtering |
| Static `AGENTS.md` / `CLAUDE.md` instructions | Filesystem + config dir | Agent instructions section, `AgentsMDInjector` ignore list |
| Dynamic nested instruction reminders | Core `AgentsMDInjector` input processor + tool-result path ancestry + reminder metadata dedupe + `tokenx`-estimated `maxTokens` cap (`1000` default) | TUI `SystemReminderComponent`, model context, memory exclusion instruction |

## Key files

- `mastracode/src/agents/instructions.ts` — builds prompt context from harness request context and refreshes current Git branch.
- `mastracode/src/agents/prompts/index.ts` — assembles base, tasks, instructions, model-specific, and mode sections using blank-line-separated non-empty sections.
- `mastracode/src/agents/prompts/base.ts` — shared environment, behavior, autonomy, communication, and late Tone/Style prompt.
- `mastracode/src/agents/prompts/model.ts` — model-specific prompt snippets keyed by exact model ID.
- `mastracode/src/agents/prompts/agent-instructions.ts` — loads `AGENTS.md`/`CLAUDE.md` instruction files from global and project locations.
- `packages/core/src/processors/tool-result-reminder.ts` — `AgentsMDInjector` scans path-bearing tool calls for nearest instruction files, token-caps/truncates/dedupes, and emits `dynamic-agents-md` system reminders.
- `mastracode/src/tui/components/system-reminder.ts` and `mastracode/src/tui/message.ts` — render and place dynamic instruction reminders in the chat transcript.
- `mastracode/src/index.ts` — wires `getDynamicInstructions()` and `AgentsMDInjector` ignored static paths into the code agent.

## Dependencies / related features

- [Interactive chat](../tui/interactive-chat.md) — every chat run uses this prompt assembly.
- [File attachments in chat input](./file-attachments.md) — attachments are per-run user message content, not static instruction context.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected mode/model affects prompt sections.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — denied tools alter tool guidance.
- [Plan approval and build handoff](../goals/plan-approval.md) — Plan-mode prompt/tool guidance must route plans through `submit_plan`.
- [Git commit attribution](../git/commit-attribution.md) — commit message guidance uses prompt-time model state.
- [Git branch context and status](../git/branch-context.md) — prompt branch is refreshed from the working tree.
- [Observational memory](../memory/observational-memory.md) — task prompt injection protects task state after memory truncation.

## Existing tests

- `mastracode/src/agents/__tests__/prompts.test.ts` — model-specific prompts (`openai/gpt-5.4`, `openai/gpt-5.5`), autonomy/base prompt guidance, late Tone/Style response guidance, goal prompt guidance, common binary context.
- `mastracode/src/agents/prompts/index.test.ts` — task-list prompt injection and escaping.
- `mastracode/src/__tests__/index.test.ts` — verifies runtime wiring uses `getDynamicInstructions()` and configures `AgentsMDInjector` with statically loaded instruction paths.
- `packages/core/src/processors/tool-result-reminder.test.ts` and `mastracode/src/tui/components/__tests__/system-reminder.test.ts` — dynamic instruction reminder injection/rendering coverage, including metadata/path dedupe, ignored static instruction paths, default/custom token caps, truncation marker, and newline-boundary trimming.
- `mastracode/src/headless-integration.test.ts` — includes nested `AGENTS.md` dynamic reminder persistence coverage.

## Missing tests

- Final prompt after thread reload preserves model/mode/task/plan state.
- Packaged/source smoke that verifies model-specific prompt IDs still match model pack IDs after model default changes.
- Direct unit coverage for static `loadAgentInstructions()` precedence: `AGENTS.md` over `CLAUDE.md`, config-dir variants, global before project, and singular `AGENT.md` ignored.
- Permission-denied tools disappear from prompt guidance in real runs.

## Known risks / regressions

- Prompt context can drift if harness state, thread metadata, and TUI footer disagree.
- Moving response-style guidance earlier/later in the prompt is behaviorally meaningful; prompt tests should catch accidental removal or stale old wording.
- Model-specific prompt text is exact-ID keyed; model-pack renames can silently drop a model-specific section unless prompt tests cover the new ID.
- Loaded-from-history runs can silently use current filesystem instructions, not the instructions that existed when history was created.
- Attachments are user-message content, not instruction context; prompt-audit tests need to inspect both channels separately.
- Static instruction loading and dynamic `AgentsMDInjector` both touch AGENTS guidance; ignored-path handling must avoid duplicate instruction reminders.
- Dynamic AGENTS reminders are produced from tool-call paths, so path-key extraction, ancestry walking, and max-token truncation must stay conservative enough to avoid leaking irrelevant or duplicate instructions while still showing enough local guidance.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
