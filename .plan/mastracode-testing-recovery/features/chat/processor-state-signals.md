# Processor state signals

## Origin PR / commit

- PR: [#17240](https://github.com/mastra-ai/mastra/pull/17240) — adds processor-driven state signals, with browser context as the first built-in state producer.
- Later changes: none known.

## User-visible behavior

- What the user can do: run agents with processors that emit named state snapshots/deltas, and see state/reactive signal markers in Mastra Code TUI history instead of opaque system-reminder text.
- Success looks like: browser state changes are persisted as thread-scoped state signals, unchanged state is deduped, active streams receive `data-signal` chunks, and reloaded TUI history renders `State snapshot: <id>` / `State delta: <id>` or generic `Signal: <tag>` markers.
- Must preserve: cache-key dedupe, snapshot-vs-delta lanes, per-thread metadata tracking, memory-backed history reconstruction, streamed and loaded-from-history parity, and hidden internal GitHub subscription reactive signals.

## Entry points / commands

- Commands / shortcuts / flags: no direct Mastra Code command; state signals are emitted by processors or by `agent.sendStateSignal(...)`.
- Automatic triggers: `Processor.computeStateSignal()` runs during input-step processing when memory/resource/thread context is available; `BrowserContextProcessor` emits `browser` snapshots or deltas from active browser context.

## TUI states

- Idle: externally sent state signals can persist to thread memory when targeting a resource/thread.
- Active / modal / error: streamed `state_signal` and `reactive_signal` content parts are inserted inline before pending assistant text; GitHub subscribe/unsubscribe reactive signals are hidden because their user-facing status has a dedicated GitHub sync UI.

## Headless / non-TUI behavior

- Supported: core Agent, ProcessorRunner, Harness content conversion, and AI SDK adapters handle state signals without the TUI.
- Not supported / unknown: no dedicated headless Mastra Code output mode for summarizing state signals beyond the underlying stream/data-part representation was verified.

## Streaming / loading / interrupted states

- Streaming / loading: `applyStateSignal()` writes signal DB messages, streams `data-signal` chunks when a writer exists, and updates thread metadata under `metadata.mastra.stateSignals`.
- Abort / retry / resume: state signals are persisted independently of the assistant response; retry/resume paths rely on state metadata and memory history to avoid duplicate unchanged signals.

## Streaming vs loaded-from-history behavior

- While actively streaming: `handleMessageUpdate()` converts streamed `state_signal` / `reactive_signal` parts into inline TUI components and keeps assistant text after those inline boundaries.
- After reload / history reconstruction: `render-messages.ts` renders persisted state/reactive signal content from `HarnessMessage` history and dedupes/filters the same hidden reactive tags.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| State-signal input | `AgentStateSignalInput` / `Processor.computeStateSignal()` return value | ProcessorRunner, `agent.sendStateSignal()`, browser processor |
| State tracking metadata | Thread `metadata.mastra.stateSignals[stateId]` | `applyStateSignal()`, `resolveStateSignalHistory()`, dedupe/versioning |
| Active signal history | Signal DB messages plus active `MessageList` window | Processor `computeStateSignal()` args (`activeStateSignals`, `lastSnapshot`, `deltasSinceSnapshot`) |
| Browser state lane | `BrowserContextProcessor.stateId = 'browser'` and request-context browser state | browser state snapshots/deltas, TUI state-signal previews |
| TUI signal projection | `StateSignalComponent` / `ReactiveSignalComponent` | streamed message updates and loaded history rendering |

## Key files

- `packages/core/src/agent/state-signals.ts` — parses state signal history, tracks snapshots/deltas, dedupes by cache key and mode, persists thread metadata, and writes signal messages.
- `packages/core/src/processors/index.ts` — exposes `computeStateSignal()` and `sendStateSignal()` processor context types.
- `packages/core/src/processors/runner.ts` — runs processor/workflow state-signal hooks during input-step processing and streams accepted signals.
- `packages/core/src/agent/thread-stream-runtime.ts` and `agent.ts` — public `agent.sendStateSignal(...)` path for external state producers.
- `packages/core/src/browser/processor.ts` — first built-in producer, emitting browser snapshot/delta state from request context.
- `mastracode/src/tui/components/state-signal.ts` and `reactive-signal.ts` — inline TUI components for state/reactive signal display.
- `mastracode/src/tui/handlers/message.ts` and `render-messages.ts` — streamed and persisted conversion into TUI components plus hidden GitHub reactive-signal filtering.

## Dependencies / related features

- [Agent signals and streaming follow-ups](./agent-signals.md) — state signals reuse the signal wire format, delivery, and data-part stream path.
- [Browser automation](../integrations/browser-automation.md) — browser context is the first processor-backed state lane.
- [Interactive TUI chat](../tui/interactive-chat.md) — state/reactive signals render as inline chat components.
- [Core Harness API and reference docs](../integrations/harness-api.md) — Harness content variants carry state/reactive signal parts.

## Existing tests

- `packages/core/src/agent/__tests__/agent-signals.test.ts` — external `sendStateSignal()` persistence, cache-key dedupe, and thread metadata tracking.
- `packages/core/src/processors/runner.test.ts` — processor/workflow state-signal execution, active history args, dedupe, snapshot refresh, and stream writer output.
- `packages/core/src/agent/agent-processor.test.ts` — state-only processors survive combined workflow resolution.
- `packages/core/src/browser/processor.test.ts` — browser snapshot, delta, live refresh, and evicted-snapshot behavior.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — loaded history renders state/reactive signals and hides GitHub subscription operation signals.
- `mastracode/src/tui/handlers/__tests__/message.test.ts` — streamed reactive/state signal rendering and inline-boundary ordering.

## Missing tests

- End-to-end Mastra Code run with a live browser producing state deltas and then reloading the same thread to prove TUI history parity.
- Headless output regression proving state-signal stream parts are useful/visible outside the TUI.
- Snapshot/delta pruning regression for very long browser sessions where earlier snapshots fall out of the active message window.

## Known risks / regressions

- State signals depend on memory, resourceId, and threadId; missing context intentionally throws for processor-generated signals.
- Dedupe combines thread metadata with active message-window checks, so regressions can either spam duplicate state rows or incorrectly suppress a needed refreshed snapshot.
- State/reactive signals are rendered as compact previews; rich structured state is preserved in metadata, not fully displayed in the TUI.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
