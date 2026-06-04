# Persistent conversations and thread switching

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — introduced project-scoped persistent threads as part of the initial Mastra Code port.
- Commit: `0e64154f1b` — `MastraCode initial port (#13218)`.

## User-visible behavior

Mastra Code saves conversations per project/resource. Users can resume existing work, create a fresh conversation, switch threads, and see prior messages reconstructed in the TUI. Thread state is expected to preserve conversation history, title, resource association, mode/model metadata, goal metadata, and selected per-thread projections without leaking ephemeral state from another thread.

## Entry points / commands

- Startup prompts for thread selection before the UI begins (`mastracode/src/tui/mastra-tui.ts:520`).
- `/new` clears the visible chat and marks the next message as a new thread (`mastracode/src/tui/commands/new.ts:3`).
- `/threads` lists all resources, opens a selector, switches thread/resource, and renders existing messages (`mastracode/src/tui/commands/threads.ts:53`).
- Headless defaults to a new thread, with `--continue`, `--thread`, `--title`, `--clone-thread`, and `--resource-id` options (`mastracode/src/headless.ts:37`, `mastracode/src/headless.ts:159`).

## TUI states

- Startup: `promptForThreadSelection()` runs before harness event subscription, so `syncInitialThreadState()` later reloads title/GitHub/goal metadata for the active thread (`mastracode/src/tui/mastra-tui.ts:556`).
- New-thread pending state: `/new` sets `state.pendingNewThread = true`, clears visible components, clears modified-file display state, and resets per-thread ephemeral harness state (`mastracode/src/tui/commands/new.ts:6`).
- Thread selection modal: `/threads` opens `ThreadSelectorComponent`, caches previews, and can switch, clone, cancel, or handle lock conflicts (`mastracode/src/tui/commands/threads.ts:80`).
- Thread changed event: clears tasks/active plan/sandbox paths, renders existing messages, loads OM progress, refreshes git branch, updates title/subscriptions/goal metadata (`mastracode/src/tui/event-dispatch.ts:144`).

## Headless / non-TUI behavior

Headless has explicit thread controls. By default it creates a new thread for each prompt; `--continue` resumes most recent, `--thread` resolves by ID/title, `--clone-thread` forks before running, and `--resource-id` overrides project resource scoping (`mastracode/src/headless.ts:140`). It outputs messages without thread selector UI.

## Streaming / loading / interrupted states

- Switching threads during active agent work should be blocked or mediated by harness/thread-lock behavior; the `/threads` command catches `ThreadLockError` and offers switch/new/clone/exit choices (`mastracode/src/tui/commands/threads.ts:8`).
- Thread events (`thread_created`, `thread_changed`) drive TUI cleanup and metadata loading (`mastracode/src/tui/event-dispatch.ts:176`).
- New-thread creation is often deferred until the next message: `/new` prepares UI state, and harness creation happens when a message is sent.

## Streaming vs loaded-from-history behavior

During streaming, the current thread has live component maps, pending tools, task insertion state, and possibly an active message stream. Loaded-from-history behavior starts from persisted thread messages and metadata: `renderExistingMessages()` rebuilds chat UI, while `syncInitialThreadState()` and `thread_changed` reload status metadata. Ephemeral per-thread state (`tasks`, `activePlan`, `sandboxAllowedPaths`) is explicitly reset on switch/new to avoid bleed-through, so features that need persistence must use thread metadata or message history rather than TUI-only fields.

## State ownership

- Thread list/history: memory/storage is authoritative; TUI selector and preview cache are projections.
- Current thread ID/resource: harness session is authoritative; TUI uses it for status and commands.
- Thread title: persisted thread metadata/storage is authoritative; TUI caches `currentThreadTitle`.
- Per-thread metadata (goal, GitHub subscriptions, current mode/model): persisted thread metadata/session is authoritative; TUI/harness state are projections.
- Ephemeral per-thread state (`tasks`, `activePlan`, `sandboxAllowedPaths`): harness state during active thread; intentionally reset on thread switch/new.
- Thread locks: harness/thread-lock utility owns concurrency; TUI only prompts after lock error.

## Key files

- `mastracode/src/tui/commands/new.ts` — prepares a fresh conversation.
- `mastracode/src/tui/commands/threads.ts` — thread selector, switch, clone, lock conflict prompt.
- `mastracode/src/tui/event-dispatch.ts` — thread_created/thread_changed cleanup and metadata projection.
- `mastracode/src/tui/mastra-tui.ts` — startup thread selection and initial metadata sync.
- `mastracode/src/headless.ts` — non-TUI thread flags and behavior.
- `mastracode/src/index.ts` — seeds sessions from existing threads and thread metadata (`mastracode/src/index.ts:647`).

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — chat render/reload is scoped to the selected thread.
- [Model auth and modes](../models/model-auth-and-modes.md) — current model/mode metadata must survive thread reload.

## Existing tests

- `mastracode/src/tui/commands/__tests__/threads.test.ts` — thread command behavior.
- `mastracode/src/tui/commands/__tests__/thread.test.ts` — direct thread command behavior.
- `mastracode/src/headless.test.ts` — headless thread flags and resolution.
- `mastracode/src/HarnessCompat.test.ts` — v1 session/thread state composition and model preservation across switches.

## Missing tests

- End-to-end TUI restart test: create thread, stream messages/tools/tasks, quit, reload, and verify reconstructed UI/status metadata.
- Thread switch test proving tasks/plan/sandbox state reset while persisted goal/model metadata reloads correctly.
- Headless `--continue` / `--thread title` regression test after Harness v1 session prefill.

## Known risks / regressions

- Slack-reported “new session creation broken on alpha” points at this feature family; verify against current branch before treating as fixed.
- Slack-reported model/mode loss on reload after model pack use depends on thread/session metadata and belongs to this feature plus model auth/modes.
- Harness v1 session prefill (`mastracode/src/index.ts:657`) is a critical migration path: stale or incomplete session records can make existing threads appear broken.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
