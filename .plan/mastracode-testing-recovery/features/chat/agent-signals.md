# Agent signals and streaming follow-ups

## Origin PR / commit

- PR: [#16231](https://github.com/mastra-ai/mastra/pull/16231) — sends Mastra Code follow-ups through Agent signals instead of the old post-run queue path when a thread is active.
- Later changes: [#16338](https://github.com/mastra-ai/mastra/pull/16338) — enables signal follow-up chat in Playground and Agent Builder UIs with pending-message previews and stream-time send controls; [#16521](https://github.com/mastra-ai/mastra/pull/16521) — uses the same structured system-reminder signal path for regular plan approval handoff; [#16622](https://github.com/mastra-ai/mastra/pull/16622) — narrows `AgentSignalContents` to string/text/file parts, preserves multimodal signal payloads, and keeps legacy DB rows readable; [#16665](https://github.com/mastra-ai/mastra/pull/16665) — routes thread subscriptions, active-run signal queues, and stream-part broadcasting through PubSub for cross-runtime delivery; [#16669](https://github.com/mastra-ai/mastra/pull/16669) — coordinates Mastra Code signals over Unix socket PubSub so separate processes can share active thread streams; [#16923](https://github.com/mastra-ai/mastra/pull/16923) — resolves active/idle delivery attributes onto persisted signals so history can distinguish interjections from normal messages; [#16939](https://github.com/mastra-ai/mastra/pull/16939) — isolates Unix socket PubSub by thread to avoid cross-thread serialization and memory growth.

## User-visible behavior

- What the user can do: type a follow-up while a threaded agent run is streaming; the message is accepted as a signal, shown as a pending/interjection user message, and echoed back through the subscribed thread stream.
- Success looks like: active-run text does not wait for `agent_end`; idle sends still start a normal stream; persisted signal messages carry `delivery="while-active"` or `delivery="message"`; cross-runtime subscribers receive run registration, stream parts, completion/abort/suspend, and signal-enqueued events over PubSub or per-thread Unix socket PubSub; unsupported signal transports fall back to legacy `streamUntilIdle`; Playground shows pending signal previews and keeps the send button available when the model/thread supports signals.
- Must preserve: signal id echo dedupe, multimodal text/file conversion without flattening file parts, active-vs-idle delivery attributes, thread subscription cleanup, tool-approval behavior while subscribed, legacy DB signal rehydration, and legacy fallback for disabled/unsupported thread signals.

## Entry points / commands

- Commands / shortcuts / flags: Enter in Mastra Code TUI, `useChat({ enableThreadSignals: true })`, Playground composer send while streaming.
- Automatic triggers: Harness thread subscription streams emit signal echoes (`data-user-message`) and lifecycle chunks; active Harness runs queue signals server-side through `sendMessage()` / `sendSignal()` options.

## TUI states

- Idle: `sendSignal()` or `sendMessage()` creates a thread if needed and starts a stream through `ifIdle.streamOptions`.
- Active / modal / error: Mastra Code projects pending interjection components until the stream echo removes/remaps them; Playground stores `pendingSignals` and renders animated preview pills; cancellation clears local pending state and aborts/unsubscribes from thread streams.

## Headless / non-TUI behavior

- Supported: core Agent/Harness signal conversion and React `useChat` signal mode are UI-agnostic; Playground and Agent Builder opt in with `enableThreadSignals`.
- Not supported / unknown: headless Mastra Code does not expose a live interactive follow-up UI, so signal follow-ups are mainly TUI/browser-runtime behavior.

## Streaming / loading / interrupted states

- Streaming / loading: `subscribeToThread()` owns live chunk delivery; `sendMessage()` sends the user signal with continuation options (`maxSteps`, model settings, instructions, provider options, tracing options, client tools).
- Abort / retry / resume: cancellation aborts the local stream controller, aborts/unsubscribes the thread subscription, finalizes the streaming assistant message, and clears pending approvals/signals.

## Streaming vs loaded-from-history behavior

- While actively streaming: pending signal previews/components are transient local projection state; signal DB messages use role `signal` with metadata and canonical text/file `content.parts`, while LLM/data-part projections preserve provider options and multimodal file payloads.
- After reload / history reconstruction: persisted signal messages render as user/reactive/system-reminder history entries, legacy `metadata.signal.contents` shapes are decoded when possible, and pending preview state does not resurrect.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Signal object | `packages/core/src/agent/signals.ts` narrowed `AgentSignalContents`, delivery-attribute resolution, and legacy content decoder | Agent DB/LLM/data-part conversion, Harness send APIs, React SDK, server schemas, history rendering |
| Harness follow-up queue | `packages/core/src/harness/harness.ts` plus the configured `PubSub` | active-run `sendSignal()`/`sendMessage()`, `drainFollowUpQueue()`, thread subscription events, cross-runtime signal enqueue/broadcast |
| Unix socket signal transport | `mastracode/src/utils/signals-pubsub.ts` + core `UnixSocketPubSub` | one socket per thread under `/tmp/mc/<resourceId>/<threadId>.sock`, cross-process TUI/headless signal sharing, broker election/backpressure, cross-thread serialization isolation |
| Mastra Code pending signal UI | `pendingSignalMessageComponentsById` / optimistic signal ids | TUI active-run interjection display and echo dedupe |
| React thread subscription | `useChat()` subscription refs + unsupported flag | Playground/Agent Builder streaming chat, tool approval, fallback path |
| Playground pending signals | `MastraRuntimeProvider.pendingSignals` + `ThreadRuntimeState` | Composer pending previews, send/cancel button state |

## Key files

- `packages/core/src/agent/signals.ts` — signal creation, active/idle delivery-attribute resolution, XML/LLM wrapping, DB-message conversion, data-part conversion, canonical text/file parts, providerOptions threading, and legacy content normalization.
- `packages/core/src/harness/harness.ts` — `sendSignal()`, `sendMessage()`, follow-up queue draining, thread stream subscription handling, and PubSub propagation into Mastra/mode agents.
- `packages/core/src/agent/thread-stream-runtime.ts` and `agent.ts` — PubSub-scoped runtime maps, cross-runtime event broadcasting, remote subscriber streams, abort/resume cleanup, and agent-level PubSub inheritance.
- `packages/core/src/events/unix-socket-pubsub.ts` and `mastracode/src/utils/signals-pubsub.ts` — Unix socket PubSub broker/client transport and per-thread socket path routing.
- `client-sdks/react/src/agent/hooks.ts` and `signal-data.ts` — `useChat()` thread-signal mode, subscription lifecycle, BaseMessageListInput-to-signal contents normalization, `sendMessage()` signal path, tool approval and legacy fallback.
- `mastracode/src/tui/mastra-tui.ts` — active-run Enter routing, pending signal message projection, pending-thread creation, queued image fallback.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` and `render-messages.ts` — Harness follow-up drain ordering and persisted signal rendering.
- `packages/playground/src/services/mastra-runtime-provider.tsx` and `lib/ai-ui/thread.tsx` — Playground signal opt-in, pending previews, composer send/cancel behavior.
- `packages/playground/src/domains/agent-builder/contexts/stream-chat-provider.tsx` — Agent Builder signal opt-in.
- `packages/server/src/server/schemas/agents.ts` and `client-sdks/client-js/src/route-types.generated.ts` — public request schema/type surface for narrowed signal contents.

## Dependencies / related features

- [Queued follow-ups and slash commands](./queued-followups.md) — Ctrl+F and image/slash fallbacks still use the TUI queue.
- [File attachments in chat input](./file-attachments.md) — signal contents preserve text/file parts for multimodal follow-ups.
- [Interactive TUI chat](../tui/interactive-chat.md) — pending user-message projection and echo dedupe are rendered in the TUI.
- [Core Harness API and reference docs](../integrations/harness-api.md) — signal sending and follow-up draining are Harness APIs.
- [Persistent `/goal` mode](../goals/persistent-goals.md) — goal continuations send structured system-reminder signals.

## Existing tests

- `packages/core/src/agent/__tests__/agent-signals.test.ts` — signal creation, DB/LLM/data-part conversion, attributes, multimodal text/file parts, providerOptions, invalid XML names, legacy type/content normalization, PubSub-isolated/cross-runtime subscriptions, UnixSocketPubSub cross-process stream broadcasting, and child-agent PubSub inheritance.
- `packages/core/src/events/unix-socket-pubsub.test.ts`, `packages/core/src/events/__tests__/per-thread-pubsub-multiprocess.test.ts`, and `mastracode/src/utils/__tests__/signals-pubsub.test.ts` — broker election, fan-out, backpressure, duplicate subscribe suppression, stale socket recovery, per-thread socket path routing, same-thread cross-process exchange, and different-thread isolation.
- `packages/core/src/harness/signal-messages.test.ts` and `signal-history.test.ts` — persisted user/reactive/system-reminder signals, history rendering, idle run completion.
- `client-sdks/react/src/agent/hooks.test.ts` — signal-enabled `useChat`, subscription lifecycle, unsupported fallback, continuation options/client tools, and subscription-native tool approval.
- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` and `render-messages.test.ts` — pending signal display, echo dedupe, signal history rendering, slash-command dedupe.
- `packages/playground/src/services/__tests__/mastra-runtime-provider.test.tsx` and `domains/agent-builder/contexts/__tests__/stream-chat-provider.test.tsx` — UI opt-in/opt-out wiring for thread signals.

## Missing tests

- Full browser/TUI integration where a multimodal follow-up is sent during a real streaming run and echoed through the subscribed thread stream.
- Playground visual regression for pending signal preview pills and send/cancel button switching while streaming.
- Cross-reload assertion that persisted signal messages reconstruct correctly without stale pending previews.

## Known risks / regressions

- Signal support spans core Agent, Harness, React SDK, Mastra Code TUI, Playground, and server handlers; mismatched option shapes can silently fall back or duplicate messages.
- Active-run images still need careful fallback behavior because not every signal path can carry every pasted attachment shape.
- Subscription cleanup must avoid leaving duplicate stream processors after agent/resource/thread switches.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
