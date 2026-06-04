# Observational memory

## Origin PR / commit

- PR: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — dynamic memory configuration, configurable thresholds, observational memory support.
- Later changes: [#13305](https://github.com/mastra-ai/mastra/pull/13305) — improved OM activation chunk selection, overshoot safeguards, and absolute buffer activation support; [#13330](https://github.com/mastra-ai/mastra/pull/13330) — restored streamed OM status/lifecycle events and observer/reflector model-change events; [#13349](https://github.com/mastra-ai/mastra/pull/13349) — temporarily raised observation `bufferActivation` to 4000 to avoid aggressive message-window shrinking while token-counting precision was investigated; [#13354](https://github.com/mastra-ai/mastra/pull/13354) — preserved OM continuation hints (`currentTask` / `suggestedContinuation`) through low-activation buffering and added degenerate observer-output guards; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added setup/global settings OM pack defaults; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — centralized OM UI progress in `HarnessDisplayState`; [#13476](https://github.com/mastra-ai/mastra/pull/13476) — fixed buffering precision, mid-step activation, blockAfter semantics, and retained-context safeguards; [#13563](https://github.com/mastra-ai/mastra/pull/13563) — made Codex-resolved OM models and OM failure aborts work with Mastra Code streams.

## User-visible behavior

- What the user can do: use persistent observational memory across Mastra Code conversations/resources.
- Success looks like: observations/reflections happen in the background without polluting chat or forgetting important context.
- Must preserve: observer/reflector model settings, thresholds, scope, attachment behavior, activation/window-retention behavior, continuation hints, and loaded memory after restart.

## Entry points / commands

- Commands / shortcuts / flags: `/om` opens observer/reflector model and threshold settings; `/setup` chooses the default OM pack.
- Automatic triggers: memory factory attaches observational memory to agent runs; startup resolves global OM settings; OM events render progress/output.

## TUI states

- Idle: `/om` modal edits observer, reflector, thresholds, caveman mode, attachment observation.
- Active / modal / error: OM markers/output can appear before the active streaming component; quiet mode suppresses buffering markers.

## Headless / non-TUI behavior

- Supported: same memory factory attaches to headless runs.
- Not supported / unknown: no `/om` modal; settings must be preconfigured.

## Streaming / loading / interrupted states

- Streaming / loading: `data-om-status`, observation, buffering, activation, and failure chunks become harness OM events and update OM UI components. Observer output now carries `currentTask` / `suggestedContinuation` separately from durable observations. Mid-step buffering activation should happen as soon as thresholds are crossed, not wait for the next user turn.
- Abort / retry / resume: OM buffering/observation failures emit typed OM failure events, abort the active harness stream, reset abort state, and prevent partial `message_start`; degenerate observer output retries once and then fails the observer run.

## Streaming vs loaded-from-history behavior

- While actively streaming: OM markers/output are live UI components around the active response; continuation hints are captured from observer output and can be persisted into thread OM metadata or buffered chunks.
- After reload / history reconstruction: memory effects are available through stored memory and thread metadata; transient OM progress markers should not resume as active work.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Observations/reflections | Memory storage + vector store when present | Agent memory retrieval |
| Observer/reflector models | Harness request context + thread settings + settings | OM model functions, `/setup`, `/om`, `om_model_changed` subscribers, Codex OAuth remapping |
| Thresholds | Harness state + thread settings + settings | Memory factory, `/om` |
| OM UI progress | Harness display state + transient TUI components | Chat/status rendering |
| OM scope | Project/resource settings via `getOmScope()` | Memory factory |
| Buffer activation math | Core OM thresholds + storage `swapBufferedToActive()` | Runtime context trimming, async buffering, blockAfter fallback |
| Continuation hints | Observer output → buffered chunks / thread OM metadata | Next observer prompt, memory context injection, activation result |

## Key files

- `mastracode/src/agents/memory.ts` — dynamic OM memory factory and Mastra Code defaults; current source sets observation `bufferActivation` to `2000` for thread scope and passes `remapForCodexOAuth: true` for observer/reflector model resolution.
- `packages/memory/src/processors/observational-memory/thresholds.ts` — activation retention floor, `blockAfter` resolution, and chunk-boundary safeguards.
- `packages/memory/src/processors/observational-memory/observational-memory.ts` — core OM runtime, mid-step activation decisions, and context injection (`<current-task>` / `<suggested-response>`).
- `packages/memory/src/processors/observational-memory/observer-runner.ts` — observer streaming call, request-context/abort propagation, parsed continuation hints, and degenerate-output retry/failure.
- `packages/memory/src/processors/observational-memory/observation-strategies/async-buffer.ts` — buffered chunk persistence for continuation hints.
- `packages/memory/src/processors/observational-memory/observation-strategies/sync.ts` — sync observation persistence into thread OM metadata.
- `packages/core/src/harness/harness.ts` — OM stream chunk handling, OM failure aborts, and observer/reflector model switch events.
- `mastracode/src/tui/commands/om.ts` — `/om` settings modal wiring.
- `mastracode/src/tui/handlers/om.ts` — OM event rendering.
- `mastracode/src/tui/components/om-settings.ts` — settings UI.
- `mastracode/src/index.ts` — memory/vector store wiring and heartbeat setup.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — OM markers render around chat streaming.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — OM uses separate observer/reflector models.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — first-run setup selects default OM pack/model.
- [Harness display state](../integrations/harness-display-state.md) — OM status/progress fields used by TUI rendering.
- [Persistent conversations](../threads/persistent-conversations.md) — OM scope/reload depends on resource/thread context.
- [Storage backend configuration](../settings/storage-backend.md) — selected storage/vector backend owns persisted observations and recall index.

## Existing tests

- `mastracode/src/tui/commands/__tests__/om.test.ts` — OM role override persistence behavior.
- `mastracode/src/tui/components/__tests__/om-settings.test.ts` — model picker behavior for OM settings.
- `mastracode/src/tui/handlers/__tests__/om.test.ts` — OM marker rendering/quiet-mode behavior.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` — core activation, reflection, overshoot, retention behavior, blockAfter fallback, continuation-hint parsing, and most-recent activated chunk hint selection.
- `packages/memory/src/processors/observational-memory/__tests__/mid-loop-observation.test.ts` — mid-step observation/activation regressions, including async buffer activation without waiting for the next user turn.
- `packages/core/src/harness/om-failure-abort.test.ts`, `om-threshold-persistence.test.ts`, `get-om-record.test.ts` — core harness OM failure/abort, threshold, and record behavior.
- `packages/memory/src/processors/observational-memory/__tests__/abort-signal.test.ts` — observer/reflector abort-signal guard behavior.
- `mastracode/src/utils/__tests__/gateway-sync.test.ts` — related heartbeat gateway sync wrapper.

## Missing tests

- End-to-end observation/reflection across restart with resource/thread scope, including `currentTask` / `suggestedContinuation` continuity.
- `/om` modal changes propagate to harness state, thread settings, settings file, and next memory factory instance.
- Mastra Code-specific test that `getDynamicMemory()` wires intended OM activation defaults into core memory.
- Mastra Code `/om` command test asserting observer/reflector model changes call `switchObserverModel()` / `switchReflectorModel()` rather than raw `setState()`.

## Known risks / regressions

- Memory factory cache key must include every setting that changes behavior.
- State is split across harness state, settings, thread settings, storage, and display state.
- Dynamic AGENTS.md reminders must not be observed into memory.
- Core OM activation defaults can drift from Mastra Code defaults; PR #13305 intended `bufferActivation: 1000` / `blockAfter: 1.2`, PR #13349 temporarily raised observation `bufferActivation` to `4000`, and current Mastra Code wiring is `bufferActivation: 2000` / `blockAfter: 2` after later precision/scope changes.
- Storage adapters must keep activation-boundary math in sync; in-memory, LibSQL, MongoDB, and PG each implement `swapBufferedToActive()`.
- Continuation hints are intentionally taken from the most recent activated chunk only; stale older hints must not leak forward after partial activation.
- OM observer/reflector model resolution must preserve requestContext so Codex OAuth remapping, reasoning effort, and gateway headers survive the memory pipeline.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
