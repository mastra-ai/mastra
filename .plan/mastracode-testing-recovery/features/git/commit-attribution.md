# Git commit attribution

## Origin PR / commit

- PR: [#13376](https://github.com/mastra-ai/mastra/pull/13376) — include the active model ID in the `Co-Authored-By` line the agent is instructed to use for commits.
- Later changes: none known.

## User-visible behavior

- What the user can do: ask Mastra Code to create commits and get a commit body that attributes the agent plus model when a model is selected.
- Success looks like: commit bodies include `Co-Authored-By: Mastra Code (<model-id>) <noreply@mastra.ai>` when `currentModelId` is available.
- Must preserve: fallback to `Co-Authored-By: Mastra Code <noreply@mastra.ai>` when no model ID is available.

## Entry points / commands

- Commands / shortcuts / flags: agent-driven `git commit` through shell execution; no dedicated slash command.
- Automatic triggers: every agent run receives Git Safety prompt guidance from `buildBasePrompt()`.

## TUI states

- Idle: next run prompt is built from current harness state, including `currentModelId`.
- Active / modal / error: an active run should keep the model ID captured when its prompt was built.

## Headless / non-TUI behavior

- Supported: shared prompt assembly means headless runs receive the same commit-message guidance.
- Not supported / unknown: no direct runtime enforcement verifies that the generated commit body includes the required line.

## Streaming / loading / interrupted states

- Streaming / loading: commit attribution is prompt guidance, not a streamed UI projection.
- Abort / retry / resume: retry/new run should rebuild the guidance from the current or restored model state.

## Streaming vs loaded-from-history behavior

- While actively streaming: the model ID is the prompt-time `PromptContext.modelId`.
- After reload / history reconstruction: model ID depends on restored harness session/thread state before the next run prompt is built.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current model ID | Harness session / `MastraCodeComposedState.currentModelId` | Prompt builder, commit guidance |
| Commit attribution text | `buildBasePrompt()` Git Safety section | Agent behavior during commits |
| Actual commit body | Git commit command written by the agent | Git history / reviewers |

## Key files

- `mastracode/src/agents/instructions.ts` — copies `state.currentModelId` into prompt context as `modelId`.
- `mastracode/src/agents/prompts/index.ts` — passes `ctx.modelId` into the base prompt.
- `mastracode/src/agents/prompts/base.ts` — Git Safety commit instruction formats the `Co-Authored-By` line with optional model ID.

## Dependencies / related features

- [Prompt context and project instructions](../chat/prompt-context.md) — prompt assembly carries model state into instructions.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected model state is the attribution source.

## Existing tests

- `mastracode/src/agents/__tests__/prompts.test.ts` — covers model-specific prompt sections, base prompt content, and both commit attribution footer formats: selected model ID and model-less fallback.
- `mastracode/src/agents/__tests__/instructions.test.ts` — covers `getDynamicInstructions()` building commit attribution guidance from restored/current harness `currentModelId` state.
- `mastracode/src/HarnessCompat.test.ts` — covers `currentModelId` moving through harness/session state.

## Missing tests

- Partial e2e covered by `commit-attribution-prompt`: a real PTY prompt reaches OpenAI AIMock and verifies the outbound model request contains `Co-Authored-By: Mastra Code (openai/gpt-5.4-mini) <noreply@mastra.ai>` rather than the model-less fallback.
- End-to-end commit-message test proving the agent-generated `git commit` body follows the prompt guidance. Deferred for now because this behavior is model-output guidance rather than runtime enforcement; the prompt contract is now shielded directly.

## Known risks / regressions

- This is instruction-only behavior; tools do not enforce the footer, so model output can omit or mutate it.
- If footer/runtime model and prompt model drift, commit attribution can name the wrong model.
- Commit guidance can become stale if model state moves again without updating `getDynamicInstructions()`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
