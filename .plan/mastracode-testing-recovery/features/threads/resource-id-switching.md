# Resource ID switching

## Origin PR / commit

- PR: [#13690](https://github.com/mastra-ai/mastra/pull/13690) — implemented Harness resource ID helper methods and improved `/resource` switching.
- Related origin: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — introduced project/resource-scoped persistent conversations.

## User-visible behavior

- What the user can do: run `/resource` to see the active resource ID and known IDs; run `/resource <id>` to switch resource scope; run `/resource reset` to return to the auto-detected/default ID.
- Success looks like: switching resources resumes the most recently updated thread for that resource, or marks the next message as a new-thread start when no thread exists.
- Must preserve: default resource ID remains stable even after overrides, and resource switches must not leave stale thread UI/tool/task projections on screen.

## Entry points / commands

- Commands / shortcuts / flags: `/resource`, `/resource <id>`, `/resource reset`; headless `--resource-id <id>`.
- Automatic triggers: Harness thread creation uses the current `resourceId`; `getKnownResourceIds()` derives IDs from stored threads across resources.

## TUI states

- Idle: `/resource` prints current/default resource plus known IDs and usage.
- Active / modal / error: switching clears chat/transient UI only after the Harness resource is changed and, when present, the latest thread for the target resource is selected.

## Headless / non-TUI behavior

- Supported: `mastracode --prompt ... --resource-id <id>` scopes headless thread operations to that resource.
- Not supported / unknown: no headless command equivalent lists known resource IDs; users must know the ID or inspect storage.

## Streaming / loading / interrupted states

- Streaming / loading: resource switching is a slash command; it should only be used between active agent runs.
- Abort / retry / resume: `setResourceId()` clears the current thread ID and agent thread subscription; the next run selects/creates under the new resource.

## Streaming vs loaded-from-history behavior

- While actively streaming: the active resource owns the selected live thread and pending UI projections.
- After reload / history reconstruction: `/resource <id>` loads the latest stored thread for that resource and then `renderExistingMessages()` reconstructs persisted messages; transient tool/task maps are cleared.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current resource ID | Core Harness `resourceId` | `/resource`, thread create/list/switch, status/analytics |
| Default resource ID | Core Harness `defaultResourceId` | `/resource reset`, status text |
| Known resource IDs | `Harness.getKnownResourceIds()` from `listThreads({ allResources: true })` | `/resource` info display |
| Current resource's latest thread | Harness `listThreads()` filtered to current resource | `/resource <id>` resume behavior |
| TUI thread-local projections | `TUIState` component maps/arrays | resource switch cleanup and history reload |

## Key files

- `mastracode/src/tui/commands/resource.ts` — `/resource` display/switch/reset behavior and TUI cleanup.
- `mastracode/src/tui/command-dispatch.ts` — routes `/resource` to the command handler.
- `mastracode/src/tui/components/help-overlay.ts` — lists `/resource` in help.
- `mastracode/src/headless.ts` — parses and documents `--resource-id`.
- `packages/core/src/harness/harness.ts` — `getResourceId()`, `setResourceId()`, `getDefaultResourceId()`, `getKnownResourceIds()`, and thread creation resource assignment.

## Dependencies / related features

- [Persistent conversations and thread switching](./persistent-conversations.md) — resource ID is the outer thread scope.
- [Storage backend configuration](../settings/storage-backend.md) — selected storage backend owns resource-scoped thread/session records.
- [Interactive TUI chat](../tui/interactive-chat.md) — resource switching clears and rebuilds chat components.
- [Plan approval and build handoff](../goals/plan-approval.md) — approved plan files are stored under resource-specific subdirectories.

## Existing tests

- `packages/core/src/harness/resource-id.test.ts` — default resource ID behavior and known-resource discovery from stored threads.
- `mastracode/src/tui/commands/__tests__/resource.test.ts` — `/resource` info display, same-resource no-op, latest-thread resume, no-thread pending-new-thread path, and reset behavior.
- `mastracode/src/headless.test.ts` — headless thread/resource argument parsing coverage.

## Missing tests

- End-to-end TUI test switching resources after a thread has streamed tool/task output, proving all transient projections reset and persisted history reloads correctly.
- Headless integration test combining `--resource-id`, `--continue`, and `--thread` across two resource scopes.
- Storage-backed test proving `getKnownResourceIds()` works with real persisted thread/session records after process restart.

## Known risks / regressions

- `/resource <id>` calls `setResourceId()` before selecting the latest thread; if thread switching fails, the resource ID is already changed.
- Known IDs only come from existing threads, so a valid resource with no threads will not appear in the list.
- Resource IDs are user-entered strings; confusing IDs can fragment history without an obvious migration/rename path.
- Current tests mock TUI state and do not verify loaded-from-history rendering after a real switch.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
