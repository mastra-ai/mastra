# Persistent conversations and thread switching

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — project-scoped persistent conversations and thread switching.
- Later changes: [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved conversation runtime onto the shared core Harness primitive and session records.

## User-visible behavior

- What the user can do: resume, create, switch, and clone conversations per project/resource.
- Success looks like: messages and thread metadata reload without leaking another thread’s ephemeral state.
- Must preserve: history, title/resource, mode/model metadata, goals, and related status projections.

## Entry points / commands

- Commands / shortcuts / flags: `/new`, `/threads`, headless `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`.
- Automatic triggers: startup thread selection, `thread_created`, `thread_changed`.

## TUI states

- Idle: active thread shown in status; `/threads` can open selector.
- Active / modal / error: thread lock conflicts should be mediated; switching resets thread-local projections.

## Headless / non-TUI behavior

- Supported: explicit thread flags in `headless.ts`; default is new thread per prompt.
- Not supported / unknown: no interactive selector; title/ID resolution must be deterministic.

## Streaming / loading / interrupted states

- Streaming / loading: current live thread owns active stream and pending tool/task projections.
- Abort / retry / resume: switching during active work depends on harness/thread-lock behavior.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI holds transient component maps, pending tools, and task insertion state.
- After reload / history reconstruction: messages come from storage; metadata is reloaded by startup/thread-change sync.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Thread history | Harness memory/storage | TUI history renderer, headless |
| Current thread/resource | Harness session | TUI status, commands |
| Thread title/metadata | Thread metadata/session records | TUI footer, goals, GitHub badges |
| Ephemeral tasks/plan/sandbox | Harness state for active thread | Prompt context, TUI projection |

## Key files

- `mastracode/src/tui/commands/new.ts` — new conversation preparation.
- `mastracode/src/tui/commands/threads.ts` — selector, switch, clone, lock conflicts.
- `mastracode/src/tui/event-dispatch.ts` — thread event cleanup/reload.
- `mastracode/src/tui/mastra-tui.ts` — startup thread sync.
- `mastracode/src/headless.ts` — non-TUI thread flags.
- `mastracode/src/index.ts` — session prefill from existing threads.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — history render is thread-scoped.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — model/mode reload depends on thread/session metadata.

## Existing tests

- `mastracode/src/tui/commands/__tests__/threads.test.ts` — thread command behavior.
- `mastracode/src/tui/commands/__tests__/thread.test.ts` — direct thread command behavior.
- `mastracode/src/headless.test.ts` — headless thread flags.
- `mastracode/src/HarnessCompat.test.ts` — v1 session/thread composition.

## Missing tests

- Restart TUI after streamed messages/tools/tasks and verify reconstructed UI/status.
- Thread switch resets ephemeral tasks/plan/sandbox but reloads persisted metadata.
- Headless `--continue` / `--thread title` after Harness v1 session prefill.

## Known risks / regressions

- Slack reported new-session creation broken on alpha; needs current repro/verification.
- Model/mode reload bug belongs partly here because thread/session metadata is the reload path.
- Harness v1 session prefill is high risk for stale/incomplete thread records.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
