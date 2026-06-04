# Observational memory

## Origin PR / commit

- PR: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — dynamic memory configuration, configurable thresholds, observational memory support.
- Later changes: [#13305](https://github.com/mastra-ai/mastra/pull/13305) — improved OM activation chunk selection, overshoot safeguards, and absolute buffer activation support; [#13330](https://github.com/mastra-ai/mastra/pull/13330) — restored streamed OM status/lifecycle events and observer/reflector model-change events; [#13349](https://github.com/mastra-ai/mastra/pull/13349) — temporarily raised observation `bufferActivation` to 4000 to avoid aggressive message-window shrinking while token-counting precision was investigated.

## User-visible behavior

- What the user can do: use persistent observational memory across Mastra Code conversations/resources.
- Success looks like: observations/reflections happen in the background without polluting chat or forgetting important context.
- Must preserve: observer/reflector model settings, thresholds, scope, attachment behavior, activation/window-retention behavior, and loaded memory after restart.

## Entry points / commands

- Commands / shortcuts / flags: `/om` opens observer/reflector model and threshold settings.
- Automatic triggers: memory factory attaches observational memory to agent runs; OM events render progress/output.

## TUI states

- Idle: `/om` modal edits observer, reflector, thresholds, caveman mode, attachment observation.
- Active / modal / error: OM markers/output can appear before the active streaming component; quiet mode suppresses buffering markers.

## Headless / non-TUI behavior

- Supported: same memory factory attaches to headless runs.
- Not supported / unknown: no `/om` modal; settings must be preconfigured.

## Streaming / loading / interrupted states

- Streaming / loading: `data-om-status`, observation, buffering, activation, and failure chunks become harness OM events and update OM UI components.
- Abort / retry / resume: OM buffering/observation failures abort the stream through core harness events; exact user-facing retry behavior still needs verification.

## Streaming vs loaded-from-history behavior

- While actively streaming: OM markers/output are live UI components around the active response.
- After reload / history reconstruction: memory effects are available through stored memory; transient OM progress markers should not resume as active work.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Observations/reflections | Memory storage + vector store when present | Agent memory retrieval |
| Observer/reflector models | Harness state + thread settings + settings | OM model functions, `/om`, `om_model_changed` subscribers |
| Thresholds | Harness state + thread settings + settings | Memory factory, `/om` |
| OM UI progress | Harness display state + transient TUI components | Chat/status rendering |
| OM scope | Project/resource settings via `getOmScope()` | Memory factory |

## Key files

- `mastracode/src/agents/memory.ts` — dynamic OM memory factory and Mastra Code defaults; current source sets observation `bufferActivation` to `2000` for thread scope.
- `packages/memory/src/processors/observational-memory/thresholds.ts` — activation retention floor and chunk-boundary safeguards.
- `packages/memory/src/processors/observational-memory/observational-memory.ts` — core OM runtime.
- `packages/core/src/harness/harness.ts` — OM stream chunk handling and observer/reflector model switch events.
- `mastracode/src/tui/commands/om.ts` — `/om` settings modal wiring.
- `mastracode/src/tui/handlers/om.ts` — OM event rendering.
- `mastracode/src/tui/components/om-settings.ts` — settings UI.
- `mastracode/src/index.ts` — memory/vector store wiring and heartbeat setup.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — OM markers render around chat streaming.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — OM uses separate observer/reflector models.
- [Persistent conversations](../threads/persistent-conversations.md) — OM scope/reload depends on resource/thread context.

## Existing tests

- `mastracode/src/tui/commands/__tests__/om.test.ts` — OM role override persistence behavior.
- `mastracode/src/tui/components/__tests__/om-settings.test.ts` — model picker behavior for OM settings.
- `mastracode/src/tui/handlers/__tests__/om.test.ts` — OM marker rendering/quiet-mode behavior.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` — core activation, reflection, overshoot, and retention behavior.
- `packages/core/src/harness/om-failure-abort.test.ts`, `om-threshold-persistence.test.ts`, `get-om-record.test.ts` — core harness OM failure, threshold, and record behavior.
- `mastracode/src/utils/__tests__/gateway-sync.test.ts` — related heartbeat gateway sync wrapper.

## Missing tests

- End-to-end observation/reflection across restart with resource/thread scope.
- `/om` modal changes propagate to harness state, thread settings, settings file, and next memory factory instance.
- Abort/failure behavior for active OM cycles.
- Mastra Code-specific test that `getDynamicMemory()` wires intended OM activation defaults into core memory.
- Mastra Code `/om` command test asserting observer/reflector model changes call `switchObserverModel()` / `switchReflectorModel()` rather than raw `setState()`.

## Known risks / regressions

- Memory factory cache key must include every setting that changes behavior.
- State is split across harness state, settings, thread settings, storage, and display state.
- Dynamic AGENTS.md reminders must not be observed into memory.
- Core OM activation defaults can drift from Mastra Code defaults; PR #13305 intended `bufferActivation: 1000` / `blockAfter: 1.2`, PR #13349 temporarily raised observation `bufferActivation` to `4000`, and current Mastra Code wiring is `bufferActivation: 2000` / `blockAfter: 2` after later precision/scope changes.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
