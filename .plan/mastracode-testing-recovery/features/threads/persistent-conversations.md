# Persistent conversations and thread switching

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — project-scoped persistent conversations and thread switching.
- Later changes: [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved conversation runtime onto the shared core Harness primitive and session records; [#13334](https://github.com/mastra-ai/mastra/pull/13334) — restored optional thread locking through core Harness config; [#13343](https://github.com/mastra-ai/mastra/pull/13343) — scoped startup auto-resume to current working directory/worktree via `projectPath` metadata; [#13690](https://github.com/mastra-ai/mastra/pull/13690) — added Harness resource ID helpers and improved `/resource` switching; [#14428](https://github.com/mastra-ai/mastra/pull/14428) — speeds `/threads` by caching and lazily loading message previews; [#14436](https://github.com/mastra-ai/mastra/pull/14436) — lets observer output update thread titles through OM metadata and Harness events.

## User-visible behavior

- What the user can do: resume, create, switch, clone, and browse conversations per project/resource/worktree with cached previews and generated titles.
- Success looks like: startup resumes only threads from the current directory, `/threads` stays responsive while previews load lazily, then messages and metadata reload without leaking another thread’s ephemeral state.
- Must preserve: history, title/resource, preview cache, mode/model metadata, goals, project path tagging, thread lock ownership, and related status projections.

## Entry points / commands

- Commands / shortcuts / flags: `/new`, `/threads`, `/resource`, headless `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`.
- Automatic triggers: startup thread selection filters by `metadata.projectPath`; `thread_created`, `thread_changed`.

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
| Current thread/resource | Harness session + resource ID helpers | TUI status, `/resource`, commands |
| Thread title/metadata | Thread metadata/session records, optionally updated by OM `threadTitle` output | TUI footer, `/threads`, goals, GitHub badges |
| Thread preview cache | `state.threadPreviewCache` + `attemptedThreadPreviewIds`, invalidated by thread `updatedAt` | `/threads` selector preview rows |
| Project path scope | Thread `metadata.projectPath` + legacy directory birthtime fallback | Startup auto-resume filtering |
| Ephemeral tasks/plan/sandbox | Harness state for active thread | Prompt context, TUI projection |
| Thread lock ownership | Core Harness `threadLock` + MC filesystem lock files | Thread create/switch/select and TUI lock prompt |

## Key files

- `mastracode/src/tui/commands/new.ts` — new conversation preparation.
- `mastracode/src/tui/commands/threads.ts` — selector, switch, clone, lock conflicts, cached preview invalidation, and lazy message-preview loading.
- `mastracode/src/tui/components/thread-selector.ts` — preview cache display, debounced/batched preview loading, sorting/filtering, and selector rendering.
- `mastracode/src/tui/event-dispatch.ts` — thread event cleanup/reload and OM thread-title update events.
- `mastracode/src/tui/setup.ts` — startup auto-resume filtering by `projectPath` and legacy birthtime fallback.
- `mastracode/src/tui/mastra-tui.ts` — startup thread sync.
- `mastracode/src/headless.ts` — non-TUI thread flags.
- `mastracode/src/index.ts` — session prefill from existing threads and threadLock wiring.
- `mastracode/src/utils/thread-lock.ts` — filesystem locks, stale lock cleanup, lock errors.
- `packages/core/src/harness/harness.ts` — lock-safe select/create/switch/delete behavior and `data-om-thread-update` event translation.
- `packages/memory/src/processors/observational-memory/*` — observer-generated `threadTitle` extraction and persistence into thread records.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — history render is thread-scoped.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — model/mode reload depends on thread/session metadata.
- [Task tracking tools and TUI progress](../tools/task-tracking.md) — task state is thread-local and must reset/reload correctly.
- [Storage backend configuration](../settings/storage-backend.md) — selected backend owns persisted thread/session history.
- [Resource ID switching](./resource-id-switching.md) — `/resource` changes the outer resource scope for thread selection.

## Existing tests

- `mastracode/src/tui/commands/__tests__/threads.test.ts` — thread command behavior and preview cache invalidation/loading.
- `mastracode/src/tui/components/__tests__/thread-selector.test.ts` — selector preview-cache seeding, debounced preview fetching, navigation debounce, and merged preview callbacks.
- `mastracode/src/tui/commands/__tests__/thread.test.ts` — direct thread command behavior.
- `mastracode/src/headless.test.ts` — headless thread flags.
- `mastracode/src/HarnessCompat.test.ts` — v1 session/thread composition.
- `packages/core/src/harness/thread-locking.test.ts` — lock acquire/release ordering, create/switch/select, and failure recovery.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` — observer/buffered `threadTitle` persistence into thread metadata/title.

## Missing tests

- Restart TUI after streamed messages/tools/tasks and verify reconstructed UI/status.
- Thread switch resets ephemeral tasks/plan/sandbox but reloads persisted metadata.
- Headless `--continue` / `--thread title` after Harness v1 session prefill.
- MC-level test that core thread lock conflicts reach the TUI lock prompt across real process-style locks.
- Startup auto-resume test for same-resource worktrees: strict `projectPath`, legacy birthtime fallback, and retroactive tagging.

## Known risks / regressions

- Slack reported new-session creation broken on alpha; needs current repro/verification.
- Model/mode reload bug belongs partly here because thread/session metadata is the reload path.
- Backend switching can make existing history appear missing unless storage migration is explicit.
- Harness v1 session prefill is high risk for stale/incomplete thread records.
- Worktrees share resource IDs; missing/incorrect `projectPath` metadata can resume the wrong directory’s thread.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
