# Source Notes

Detailed audit-style findings for Harness and Agent Builder/CMS-style config provenance live in:

- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`

This file keeps only the source observations needed for shape fit.

## Agent Signals

Sources:

- `packages/core/src/agent/signals.ts`
- `packages/core/src/agent/state-signals.ts`
- `packages/core/src/signals/signal-provider.ts`
- `packages/core/src/signals/task-signal-provider.ts`
- `packages/core/src/processors/send-signal.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`

Observed:

- Signal categories are `user`, `state`, `reactive`, and `notification`.
- Legacy types normalize to categories, e.g. `user-message` becomes `user`.
- Signals can become DB messages, LLM messages, and streamed data parts.
- State signals have `snapshot` and `delta` modes, `cacheKey`, optional `value`, optional `delta`, version metadata, and active-copy tracking.
- `applyStateSignal` skips unchanged state by comparing cache key/mode/version and active window.
- `SignalProvider` owns subscriptions between an agent thread and an external resource.
- `TaskSignalProvider` wires task tools plus a task state processor.

Shape pressure:

- User/reactive/notification signals are clean `Pulse(input)` candidates.
- State signals are state/context `Change` candidates, and may also create a runtime `Pulse` when applied into model context.
- Provider subscriptions are more naturally `Relationship` or `Change`, not Pulse.

## Harness

Sources:

- `packages/core/src/harness/types.ts`
- `packages/core/src/harness/harness.ts`
- `packages/core/src/harness/session.ts`
- `packages/core/src/harness/session-run-engine.ts`
- `packages/core/src/storage/domains/harness/types.ts`
- `packages/core/src/storage/domains/harness/base.ts`

Observed:

- `HarnessEvent` is a broad UI-facing event union.
- The run engine consumes stream chunks and emits display-oriented message/tool/usage/OM/subagent events.
- Text and reasoning deltas mutate `HarnessMessage` snapshots.
- Tool approval and suspension are explicit event families.
- Tool suspensions can be resumed later by `toolCallId`.
- Harness pending storage records `tool-approval`, `tool-suspension`, `question`, and `plan-approval`.

Shape pressure:

- Harness events cannot be used 1:1 as Pulse exports.
- Runtime facts are useful, but `message_update` and `display_state_changed` are read-model artifacts.
- Suspension/resume needs both Pulse and Relationship.
- Pending storage needs Change, but emitted at caller.

## Message Context

Sources:

- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/agent/message-list/state/MessageStateManager.ts`
- `packages/core/src/agent/message-list/merge/MessageMerger.ts`
- `packages/core/src/loop/workflows/agentic-execution/build-messages-from-chunks.ts`
- `packages/core/src/processors/memory/message-history.ts`
- `packages/core/src/processors/processors/message-selection.ts`

Observed:

- `MessageList` has source categories: memory, input, response, context.
- It records mutations for observability: `add`, `addSystem`, `removeByIds`, and `clear`.
- Current span serialization exports simplified messages and system messages.
- `MessageMerger` mutates assistant messages by appending parts and updating tool invocation state.
- `buildMessagesFromChunks` reconstructs final DB messages from stream chunks.
- `MessageHistory` recalls old messages and persists new input/output messages.

Shape pressure:

- Message-list mutations map cleanly to `Change(context.*)`.
- `message_update` snapshots should not be Pulse exports.
- Stream chunks are better Pulse source material than final message arrays.
- Context reconstruction needs refs and probably bounded snapshots.

## Agent Config Provenance

Sources:

- `packages/core/src/agent-builder/ee/*`
- `packages/core/src/storage/domains/agents/*`
- `packages/core/src/storage/domains/versioned.ts`

Observed:

- Agent Builder core code currently visible in `packages/core/src` is mostly picker/policy/allowlist normalization.
- Agent storage is versioned and stores `changedFields`, `changeMessage`, `versionNumber`, `activeVersionId`, and resolved version ids.
- Config fields are stored on version rows, separate from thin entity rows.

Shape pressure:

- Picker/policy decisions are not the main Pulse target.
- Agent config mutations are `Change` candidates because they explain later runtime behavior.
- Runtime flows should reference config versions rather than duplicate instructions/tool schemas/model settings.

