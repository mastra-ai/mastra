# File-by-File Pulse Candidate Audit

Scope: `packages/core/src`.

This pass is broader than the traditional observability audit. It looks for places that may deserve Pulse events even when the current code does not emit spans, logs, metrics, scores, or feedback.

Working heuristic:

- lifecycle boundary: something starts, stops, resumes, suspends, reconnects, retries, times out, or is destroyed
- decision point: code chooses a branch that affects execution, routing, authorization, delivery, or visibility
- external boundary: code calls a model, tool, workflow, storage adapter, sandbox, browser, network, pubsub, or user callback
- queue/state transition: work is queued, claimed, dropped, deduped, cached, persisted, replayed, or projected
- error normalization: unknown errors are converted, swallowed, retried, or turned into user-visible state

This file is intentionally incremental. Each section records the files inspected and candidate Pulse events found.

## `signals`

Files inspected:

- `packages/core/src/signals/index.ts`
- `packages/core/src/signals/signal-provider.ts`
- `packages/core/src/signals/task-signal-provider.ts`
- `packages/core/src/signals/webhook-signal-provider.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `signals/signal-provider.ts` | `SignalProvider` class definition | `signal_provider.created` | Provider construction/configuration is the root of all later signal activity. |
| `signals/signal-provider.ts` | subscription registration around `subscribe(...)` | `signal_subscription.started` | A provider begins monitoring an external source for a specific resource/thread pair. |
| `signals/signal-provider.ts` | unsubscribe methods | `signal_subscription.ended` | Explicit end of external-source monitoring. Useful for leak/debug analysis. |
| `signals/signal-provider.ts` | `startPolling(...)` / polling loop | `signal_poll.started`, `signal_poll.completed`, `signal_poll.failed` | Polling is periodic work with external source latency and failure behavior. |
| `signals/signal-provider.ts:421` | `handleWebhook?(...)` | `signal_webhook.received`, `signal_webhook.accepted`, `signal_webhook.rejected` | Webhook ingress is a point-in-time external event. |
| `signals/signal-provider.ts:450` | `notify(...)` | `notification_signal.sent`, `notification_signal.failed` | Sends a notification into an agent thread but currently has no direct observability event. |
| `signals/signal-provider.ts:454` | missing connected agent error | `notification_signal.failed` | Important setup/configuration failure that should be visible as a structured event. |
| `signals/task-signal-provider.ts` | `TaskSignalProvider` construction | `task_signal_provider.created` | Bundles task tools + state processor; useful to know it was auto/explicitly registered. |
| `signals/webhook-signal-provider.ts` | `handleWebhook(...)` implementation | `webhook_signal.received`, `webhook_signal.dispatched` | Generic webhook signal provider likely needs request metadata, provider id, target count, and result status. |

Notes:

- Signal providers already model point-in-time external stimuli. They are probably closer to Pulse than to span-based tracing.
- Candidate attributes: `providerId`, `resourceId`, `threadId`, `externalResourceId`, webhook status, poll interval, subscription count.
- Candidate metadata: tenant/org/user/request context if available.

## `notifications`

Files inspected:

- `packages/core/src/notifications/delivery-policy.ts`
- `packages/core/src/notifications/dispatcher.ts`
- `packages/core/src/notifications/index.ts`
- `packages/core/src/notifications/signals.ts`
- `packages/core/src/notifications/storage.ts`
- `packages/core/src/notifications/tool.ts`
- `packages/core/src/notifications/types.ts`
- `packages/core/src/notifications/workflow.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `notifications/dispatcher.ts` | thread state lookup around delivery | `notification_delivery.evaluated` | Delivery behavior depends on active/idle thread state. Decision should be visible. |
| `notifications/dispatcher.ts` | notification dispatch path | `notification_delivery.sent` | Notification enters a thread/user-visible channel. |
| `notifications/dispatcher.ts` | dispatch skip/defer paths | `notification_delivery.skipped`, `notification_delivery.deferred` | Important user-visible non-delivery decisions. |
| `notifications/delivery-policy.ts` | policy decision functions | `notification_policy.selected` | Encodes active-vs-idle policy, summary decisions, and priority behavior. |
| `notifications/signals.ts` | signal-to-notification conversion | `notification_signal.converted` | Boundary where an agent signal becomes notification data. |
| `notifications/storage.ts` | notification persistence | `notification.persisted`, `notification.persistence_failed` | Durable notification records should be observable without reading storage logs. |
| `notifications/tool.ts` | notification tool execution | `notification_tool.called` | User/model-triggered notification requests should be linked to agent/tool context. |
| `notifications/workflow.ts` | notification workflow helper | `notification_workflow.started`, `notification_workflow.completed` | Workflow-level notification fanout is likely a distinct operational event. |

Notes:

- Notification policy decisions look like Pulse `decision` types.
- Candidate data: `notificationCount`, `summaryCount`, delivery latency, active/idle state.
- Candidate attributes: priority, channel/provider, target thread/resource, policy reason.

## `events`

Files inspected:

- `packages/core/src/events/pubsub.ts`
- `packages/core/src/events/types.ts`
- `packages/core/src/events/processor.ts`
- `packages/core/src/events/caching-pubsub.ts`
- `packages/core/src/events/unix-socket-pubsub.ts`
- `packages/core/src/events/event-emitter/index.ts`
- `packages/core/src/events/event-emitter/ack-handle-buffer.ts`
- `packages/core/src/events/event-emitter/batch-policy.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `events/event-emitter/index.ts:88` | `publish(...)` | `pubsub.publish` | A message enters a topic with delivery attempt metadata. |
| `events/event-emitter/index.ts:103` | `subscribe(...)` | `pubsub.subscription.started` | Subscription start is currently invisible unless downstream behavior fails. |
| `events/event-emitter/index.ts:160` | `unsubscribe(...)` | `pubsub.subscription.ended` | Important cleanup/lifecycle event. |
| `events/event-emitter/index.ts:210` | `flush(...)` | `pubsub.flush.started`, `pubsub.flush.completed` | Flush can wait on pending nacks and batch buffers. |
| `events/event-emitter/index.ts:263` | `close(...)` | `pubsub.closed` | Cancels pending nacks and clears buffers/listeners. |
| `events/event-emitter/index.ts:313` | `deliverToGroup(...)` | `pubsub.delivery.attempted` | Grouped delivery chooses one subscriber and tracks attempts. |
| `events/event-emitter/index.ts:327` | `ack` closure | `pubsub.delivery.acked` | Ack is a point-in-time result signal. |
| `events/event-emitter/index.ts:332` | `nack` closure | `pubsub.delivery.nacked` | Nack schedules redelivery and increments attempt. |
| `events/event-emitter/ack-handle-buffer.ts:53` | `push(...)` | `pubsub.batch.enqueued` | Event enters batch buffer. |
| `events/event-emitter/ack-handle-buffer.ts:66` | `flush(...)` | `pubsub.batch.flushed` | Batch delivery has delivered/dropped counts. |
| `events/event-emitter/ack-handle-buffer.ts:95` | `prepareBatch(...)` result | `pubsub.batch.dropped` | Coalesce/overflow drops should be visible. |
| `events/event-emitter/batch-policy.ts:69` | `onEnqueue(...)` | `pubsub.batch.decision` | Decides `flush-now` vs `wait`. |
| `events/event-emitter/batch-policy.ts:123` | `prepareBatch(...)` | `pubsub.batch.prepared` | Key point for coalescing/overflow behavior. |
| `events/unix-socket-pubsub.ts:161` | `publish(...)` | `pubsub.ipc.publish` | Cross-process event boundary. |
| `events/unix-socket-pubsub.ts:198` | `subscribe(...)` | `pubsub.ipc.subscription.started` | Remote broker subscribe can fail/recover. |
| `events/unix-socket-pubsub.ts:241` | `close(...)` | `pubsub.ipc.closed` | Socket/broker cleanup event. |
| `events/unix-socket-pubsub.ts:264` | `#ensureStarted(...)` | `pubsub.ipc.ensure_started` | May trigger broker election/reconnect. |
| `events/unix-socket-pubsub.ts:281` | `#start(...)` | `pubsub.ipc.start_attempted` | Opens or connects socket. |
| `events/unix-socket-pubsub.ts:384` | client disconnect handling | `pubsub.ipc.client_disconnected` | Recovery path starts here. |
| `events/unix-socket-pubsub.ts:393` | `#recoverClientConnection(...)` | `pubsub.ipc.reconnect_scheduled` | Reconnect loops are hard to debug without events. |
| `events/unix-socket-pubsub.ts:418` | `#electBroker(...)` | `pubsub.ipc.broker_election` | Broker election should be a first-class diagnostic event. |
| `events/unix-socket-pubsub.ts:539` | queued remote client writes | `pubsub.ipc.write_queued` | Tracks queued bytes and backpressure. |
| `events/unix-socket-pubsub.ts:544` | remote client queue overflow | `pubsub.ipc.client_dropped` | Drops slow remote client when queued bytes exceed limit. |
| `events/unix-socket-pubsub.ts:641` | local callback invocation | `pubsub.delivery.attempted` | Local delivery and redelivery loop. |
| `events/caching-pubsub.ts` | cached publish/replay path | `pubsub.cache.recorded`, `pubsub.cache.replayed` | Cache/replay behavior should expose hit/miss/replay counts. |
| `events/processor.ts` | event processor dispatch | `event_processor.handled`, `event_processor.failed` | Event processors are delivery/dispatch boundaries. |

Notes:

- PubSub has strong Pulse density: publish, subscribe, ack, nack, redelivery, batching, coalescing, overflow, broker election, reconnect.
- Candidate data: delivery attempt, batch size, dropped count, queued bytes, subscriber count, reconnect attempt.
- Candidate attributes: topic, group, event type, local-only, broker/client role.

## `background-tasks`

Files inspected:

- `packages/core/src/background-tasks/create.ts`
- `packages/core/src/background-tasks/index.ts`
- `packages/core/src/background-tasks/manager.ts`
- `packages/core/src/background-tasks/resolve-config.ts`
- `packages/core/src/background-tasks/schema-injection.ts`
- `packages/core/src/background-tasks/system-prompt.ts`
- `packages/core/src/background-tasks/types.ts`
- `packages/core/src/background-tasks/workflow-id.ts`
- `packages/core/src/background-tasks/workflow.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `background-tasks/resolve-config.ts:26` | `resolveBackgroundConfig(...)` | `background_task.config_resolved` | Decision point that chooses foreground vs background, timeout, and retries. |
| `background-tasks/resolve-config.ts:41` | disabled short-circuit | `background_task.disabled` | Important reason why model/tool override did not schedule background work. |
| `background-tasks/create.ts` | task creation helper | `background_task.created` | Background task enters durable/managed lifecycle. |
| `background-tasks/manager.ts` | task start path | `background_task.started` | Externalized work begins; should include agent/tool/thread/run context. |
| `background-tasks/manager.ts` | progress/update path | `background_task.progress` | Long-running progress is inherently pulse-shaped. |
| `background-tasks/manager.ts` | completion path | `background_task.completed` | Terminal success with output metadata. |
| `background-tasks/manager.ts` | failure path | `background_task.failed` | Terminal failure should be first-class, not only stream chunk. |
| `background-tasks/manager.ts` | cancellation path | `background_task.cancelled` | User/system cancellation is an important decision/outcome. |
| `background-tasks/manager.ts` | stale recovery path | `background_task.recovered`, `background_task.recovery_failed` | Recovery of stale background tasks is operationally important. |
| `background-tasks/manager.ts` | stream/subscription path | `background_task.stream.subscribed`, `background_task.stream.closed` | Long-running agents depend on this stream. |
| `background-tasks/workflow.ts` | workflow bridge | `background_task.workflow_started`, `background_task.workflow_finished` | Background task execution crosses into workflow engine. |
| `background-tasks/schema-injection.ts` | `_background` schema injection | `background_task.schema_injected` | Model-visible capability changed. Useful for debugging tool-call behavior. |
| `background-tasks/system-prompt.ts` | system prompt generation | `background_task.prompt_generated` | Agent behavior is affected by this generated instruction. |

Notes:

- Background task lifecycle events should probably not be spans in Pulse. They are already discrete state transitions.
- Candidate data: `timeoutMs`, `maxRetries`, retry attempt, elapsed time from paired pulses, output size.
- Candidate attributes: task id, tool name, run id, thread/resource ids, status, reason, background config source.

## `workspace` and `workspace/tools`

Files inspected:

- `packages/core/src/workspace/workspace.ts`
- `packages/core/src/workspace/filesystem/*`
- `packages/core/src/workspace/lsp/*`
- `packages/core/src/workspace/search/*`
- `packages/core/src/workspace/skills/*`
- `packages/core/src/workspace/sandbox/*`
- `packages/core/src/workspace/tools/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `workspace/workspace.ts` | workspace construction/configuration | `workspace.created` | Captures enabled providers, dynamic resolver presence, sandbox/filesystem/search capabilities. |
| `workspace/workspace.ts:883` | dynamic sandbox cache key resolution | `workspace.sandbox_cache.resolved` | Cache hit/miss/key decisions affect tool continuity across requests. |
| `workspace/workspace.ts:912` | dynamic sandbox cache clearing | `workspace.sandbox_cache.cleared` | Operationally important when users reset or invalidate sandbox state. |
| `workspace/workspace.ts` | filesystem/search/sandbox resolver calls | `workspace.provider.resolved`, `workspace.provider.resolve_failed` | Dynamic provider resolution is currently mostly implicit. |
| `workspace/tools/tools.ts:62` | `resolveDynamicValue(...)` catches dynamic config errors | `workspace_tool.config_resolution_failed` | Dynamic tool config fallback decision should be visible. |
| `workspace/tools/tools.ts:128` | `resolveToolConfig(...)` | `workspace_tool.config_resolved` | Determines enabled/approval/read-before-write/name/hooks. |
| `workspace/tools/tools.ts:187` | `resolveEffectiveWorkspace(...)` | `workspace.provider.resolved` | Per-call dynamic workspace resolution can be expensive or fail. |
| `workspace/tools/tools.ts:252` | read/write tracker wrapper begins execution | `workspace_file.read_tracker.checked` | Policy gate before writes; useful as Pulse `decision`. |
| `workspace/tools/tools.ts:273` | read-before-write requirement | `workspace_file.read_required` | Agent is blocked from writing until file is read. |
| `workspace/tools/tools.ts:283` | re-read check | `workspace_file.reread_required` | Optimistic concurrency decision. |
| `workspace/tools/tools.ts:305` | read tracker records read | `workspace_file.read_recorded` | State transition in file safety subsystem. |
| `workspace/tools/tools.ts:310` | write clears read record | `workspace_file.read_record_cleared` | Completes read-before-write lifecycle. |
| `workspace/tools/tools.ts:333` | hook wrapper starts | `workspace_tool.hook_started`, `workspace_tool.hook_failed` | Tool hooks are user code boundaries. |
| `workspace/tools/tools.ts:357` | write lock wrapper | `workspace_file.write_lock.waited`, `workspace_file.write_lock.acquired`, `workspace_file.write_lock.released` | Concurrent writes are serialized but lock waits are not visible. |
| `workspace/tools/tools.ts:409` | tool added to workspace toolset | `workspace_tool.registered` | Captures final exposed tool name and policy. |
| `workspace/tools/tools.ts:452` | duplicate tool name error | `workspace_tool.registration_failed` | Registration conflict should be structured. |
| `workspace/tools/execute-command.ts` | execute command foreground/background paths | `workspace_command.started`, `workspace_command.completed`, `workspace_command.failed` | Existing workspace spans cover this, but Pulse should likely capture process lifecycle as discrete events. |
| `workspace/tools/get-process-output.ts` | process output read | `workspace_process.output_read` | Reads retained stdout/stderr and exit code for background process. |
| `workspace/tools/kill-process.ts` | kill request | `workspace_process.kill_requested`, `workspace_process.killed` | User/model kills background process. |
| `workspace/tools/lsp-inspect.ts` | LSP inspection branches | `workspace_lsp.inspected`, `workspace_lsp.unavailable` | LSP support is capability/state dependent. |
| `workspace/search/search-engine.ts` | indexing/search execution | `workspace_search.indexed`, `workspace_search.queried` | Search has result count and index state; currently tool span only sees high-level action. |
| `workspace/skills/local-skill-source.ts` | local skill load | `workspace_skill.loaded`, `workspace_skill.load_failed` | Skill source fetch/load is not traced. |
| `workspace/skills/versioned-skill-source.ts` | versioned skill lookup | `workspace_skill.version_resolved` | Useful for debugging selected skill versions. |
| `workspace/skills/publish.ts` | publish path | `workspace_skill.publish_started`, `workspace_skill.publish_completed`, `workspace_skill.publish_failed` | External publication/update lifecycle. |

Notes:

- Workspace tools already create `WORKSPACE_ACTION` spans. Pulse candidates here are lower-level decisions and state transitions inside the workspace subsystem.
- Candidate data: result count, bytes transferred, lock wait count, process exit code, output bytes retained/truncated.
- Candidate attributes: provider type, workspace id/name, exposed tool name, path, command category, dynamic resolver source.

## `workspace/sandbox`

Files inspected:

- `workspace/sandbox/mastra-sandbox.ts`
- `workspace/sandbox/local-sandbox.ts`
- `workspace/sandbox/local-process-manager.ts`
- `workspace/sandbox/process-manager/process-manager.ts`
- `workspace/sandbox/process-manager/process-handle.ts`
- `workspace/sandbox/mount-manager.ts`
- `workspace/sandbox/native-sandbox/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `workspace/sandbox/mastra-sandbox.ts:226` | `_start()` | `sandbox.start_requested` | Start lifecycle begins. |
| `workspace/sandbox/mastra-sandbox.ts:260` | status set to `starting` | `sandbox.status_changed` | Status transition should be first-class. |
| `workspace/sandbox/mastra-sandbox.ts:278` | `onStart` callback failure | `sandbox.lifecycle_hook.failed` | User callback failure is swallowed/logged but operationally important. |
| `workspace/sandbox/mastra-sandbox.ts:294` | pending mount processing warning | `sandbox.mount_processing.failed` | Mount processing failure should be structured. |
| `workspace/sandbox/mastra-sandbox.ts` | `_stop()` and `_destroy()` wrappers | `sandbox.stop_requested`, `sandbox.destroy_requested`, `sandbox.status_changed` | Stop/destroy are lifecycle boundaries. |
| `workspace/sandbox/process-manager/process-manager.ts:77` | `ensureRunning()` before process operation | `sandbox.ensure_running` | Lazy-start trigger before spawn/list/get. |
| `workspace/sandbox/process-manager/process-manager.ts:81` | `spawn(...)` | `sandbox_process.spawned` | Direct process use outside workspace tools lacks tracing. |
| `workspace/sandbox/process-manager/process-manager.ts:86` | abort signal kill hook | `sandbox_process.abort_bound`, `sandbox_process.abort_kill_requested` | Abort behavior affects long-running commands. |
| `workspace/sandbox/process-manager/process-manager.ts:103` | process list | `sandbox_process.listed` | Process inventory event. |
| `workspace/sandbox/process-manager/process-manager.ts:108` | process get/prune | `sandbox_process.inspected`, `sandbox_process.pruned` | Retained exited process cleanup. |
| `workspace/sandbox/process-manager/process-handle.ts` | output retention/truncation | `sandbox_process.output_truncated` | Important for debugging lost stdout/stderr. |
| `workspace/sandbox/local-process-manager.ts` | local spawn/wait/output | `sandbox_process.exited`, `sandbox_process.output_received` | Local process lifecycle. |
| `workspace/sandbox/local-sandbox.ts` | start/stop/destroy implementation | `local_sandbox.started`, `local_sandbox.stopped`, `local_sandbox.destroyed` | Provider-specific lifecycle. |
| `workspace/sandbox/mount-manager.ts:241` | pending mount processing | `sandbox_mount.processing_started`, `sandbox_mount.processing_completed` | Batch mount processing. |
| `workspace/sandbox/mount-manager.ts:268` | mount skipped by hook | `sandbox_mount.skipped` | Decision from hook. |
| `workspace/sandbox/mount-manager.ts:316` | mount successful | `sandbox_mount.mounted` | Mount lifecycle success. |
| `workspace/sandbox/mount-manager.ts:324` | mount failed | `sandbox_mount.failed` | Mount lifecycle failure. |
| `workspace/sandbox/native-sandbox/detect.ts` | backend detection | `native_sandbox.detected`, `native_sandbox.unavailable` | Platform capability decision. |
| `workspace/sandbox/native-sandbox/wrapper.ts` | command wrapping | `native_sandbox.command_wrapped` | Execution security boundary. |

Notes:

- Sandbox lifecycle should probably be Pulse-first rather than only logs/spans.
- Candidate data: queued mount count, output bytes, retained bytes, process count, exit code.
- Candidate attributes: sandbox id/name/provider, command, cwd, pid, mount path/provider, native backend.

## `tools/code-mode`

Files inspected:

- `tools/code-mode/code-mode.ts`
- `tools/code-mode/runner.ts`
- `tools/code-mode/stub-generator.ts`
- `tools/code-mode/transport.ts`
- `tools/code-mode/types.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `tools/code-mode/code-mode.ts` | top-level tool execute | `code_mode.started`, `code_mode.completed`, `code_mode.failed` | Code Mode is a multi-step execution boundary. |
| `tools/code-mode/runner.ts:87` | console capture emits log frames | `code_mode.log` | Currently returned as tool logs, not structured observability. |
| `tools/code-mode/runner.ts` | RPC request frame | `code_mode.rpc_requested` | Sandboxed program calls external tool. |
| `tools/code-mode/runner.ts` | RPC response/error frame | `code_mode.rpc_completed`, `code_mode.rpc_failed` | External tool boundary from sandbox. |
| `tools/code-mode/transport.ts:62` | runner process spawn | `code_mode.runner_spawned` | Starts sandbox process. |
| `tools/code-mode/transport.ts:82` | frame parse | `code_mode.frame_received`, `code_mode.frame_parse_failed` | Parse failures are currently ignored. |
| `tools/code-mode/transport.ts:91` | log frame accumulation | `code_mode.log_received` | User code console output captured. |
| `tools/code-mode/transport.ts:115` | external call hook | `code_mode.external_call_started` | Hook exists, no built-in event. |
| `tools/code-mode/transport.ts:121` | external result hook with duration/error | `code_mode.external_call_completed`, `code_mode.external_call_failed` | Good Pulse pair for duration derivation. |
| `tools/code-mode/stub-generator.ts` | generated stub creation | `code_mode.stub_generated` | Changes executable surface exposed to the model program. |

Notes:

- Code Mode already has frames that look like pulses. The main missing piece is feeding them into a unified Pulse stream.
- Candidate attributes: tool ids exposed, runner path, sandbox provider, RPC tool name, frame type.

## `agent/thread-stream-runtime` and `agent/save-queue`

Files inspected:

- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/agent/save-queue/index.ts`
- `packages/core/src/agent/state-signals.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `agent/thread-stream-runtime.ts:315` | `prepareRunOptions(...)` | `agent_thread_run.prepared` | A run gets an abort controller and becomes addressable by thread/run id before streaming starts. |
| `agent/thread-stream-runtime.ts:339` | `abortRun(...)` | `agent_thread_run.abort_requested`, `agent_thread_run.aborted` | User/system abort is a point-in-time command and result. Current behavior only mutates runtime state and publishes thread events. |
| `agent/thread-stream-runtime.ts:370` | `abortThread(...)` | `agent_thread.abort_requested` | Thread-level abort resolves to the active blocking run, which is an important routing decision. |
| `agent/thread-stream-runtime.ts:401` | `#persistSignal(...)` | `agent_signal.persisted`, `agent_signal.persistence_skipped` | Signal messages can be saved to memory, skipped when memory is absent, or fail during storage. |
| `agent/thread-stream-runtime.ts:410` | `#broadcastPersistedSignal(...)` | `agent_signal.broadcast_started`, `agent_signal.broadcast_completed` | Persisted idle signals are projected as synthetic streams for subscribers. |
| `agent/thread-stream-runtime.ts:479` | `registerRun(...)` | `agent_thread_run.registered` | A stream becomes the active run for a thread and subscribers can attach. |
| `agent/thread-stream-runtime.ts:505` | `#watchThreadRunCompletion(...)` | `agent_thread_run.completed`, `agent_thread_run.suspended` | Completion cleanup distinguishes suspended approval runs from normal terminal runs. |
| `agent/thread-stream-runtime.ts:532` | pre-run leftover folding in `#drainPendingSignals(...)` | `agent_signal.queue_promoted` | Pre-run signals can be moved into the follow-up queue if a run ends before first model request. |
| `agent/thread-stream-runtime.ts:540` | queued signal drain | `agent_signal.drained`, `agent_thread_run.continuation_started` | Pending signal starts a follow-up agent stream with a fresh run id. |
| `agent/thread-stream-runtime.ts:1140` | `queueMessage(...)` active-run path | `agent_signal.queued_until_idle` | Incoming message is accepted but deferred behind an active run. |
| `agent/thread-stream-runtime.ts:1185` | `sendStateSignal(...)` | `agent_state_signal.applied`, `agent_state_signal.skipped` | State signal updates memory/thread state and can be skipped as unchanged. |
| `agent/state-signals.ts` | `applyStateSignal(...)` storage/update path | `agent_state_signal.thread_updated`, `agent_state_signal.thread_update_failed` | State signals mutate thread state and create a signal message. |
| `agent/save-queue/index.ts:29` | `debounceSave(...)` | `memory_save.debounced`, `memory_save.debounce_replaced` | Memory saves are delayed/coalesced; this explains why a message is not persisted immediately. |
| `agent/save-queue/index.ts:60` | `enqueueSave(...)` | `memory_save.enqueued`, `memory_save.failed` | Per-thread persistence queue serializes writes and currently only logs errors. |
| `agent/save-queue/index.ts:95` | `persistUnsavedMessages(...)` | `memory_save.started`, `memory_save.completed`, `memory_save.skipped` | Drains unsaved messages and writes to memory; message count should be visible. |
| `agent/save-queue/index.ts:114` | `batchMessages(...)` stale branch | `memory_save.flush_selected`, `memory_save.debounce_selected` | Decision point between immediate flush and debounce based on staleness. |
| `agent/save-queue/index.ts:134` | `flushMessages(...)` | `memory_save.flush_requested` | Explicit durability boundary used on finish/shutdown/critical transitions. |

Notes:

- This runtime already has a rich local event vocabulary (`run-registered`, `run-suspended`, `run-aborted`, `signal-enqueued`). Pulse could make those observable beyond the in-memory/pubsub coordination channel.
- Candidate data: queued signal count, unsaved message count, debounce age, queue depth, active run count.
- Candidate attributes: `runId`, `threadId`, `resourceId`, signal type/tag, memory backend presence, abort source.

## `agent/durable`

Files inspected:

- `packages/core/src/agent/durable/durable-agent.ts`
- `packages/core/src/agent/durable/evented-agent.ts`
- `packages/core/src/agent/durable/run-registry.ts`
- `packages/core/src/agent/durable/preparation.ts`
- `packages/core/src/agent/durable/stream-adapter.ts`
- `packages/core/src/agent/durable/durable-stream-until-idle.ts`
- `packages/core/src/agent/durable/workflows/create-durable-agentic-workflow.ts`
- `packages/core/src/agent/durable/workflows/steps/tool-call.ts`
- `packages/core/src/agent/durable/workflows/steps/llm-execution.ts`
- `packages/core/src/agent/durable/workflows/steps/background-task-check.ts`
- `packages/core/src/agent/durable/workflows/steps/scorer-execution.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `agent/durable/preparation.ts` | durable preparation helper | `durable_agent.prepared`, `durable_agent.prepare_failed` | Converts normal agent inputs into serializable workflow input and registry state before execution. |
| `agent/durable/durable-agent.ts:437` | `stream(...)` after preparation | `durable_agent.stream_started` | Durable stream begins and creates the run registry entry + pubsub subscription. |
| `agent/durable/durable-agent.ts:448` | local/global registry registration | `durable_agent.registry_registered` | Non-serializable runtime state becomes available for later workflow steps/resume. |
| `agent/durable/durable-agent.ts:459` | auto-cleanup scheduling | `durable_agent.cleanup_scheduled` | Cleanup is intentionally delayed after finish/error and not scheduled on suspend. |
| `agent/durable/durable-agent.ts:470` | `createDurableAgentStream(...)` | `durable_agent.stream_subscribed` | Client-facing stream attaches to cached PubSub events. |
| `agent/durable/durable-agent.ts:500` | ready then workflow execution | `durable_agent.workflow_start_requested`, `durable_agent.workflow_start_failed` | Race-sensitive handoff from stream subscription to workflow execution. |
| `agent/durable/durable-agent.ts:537` | `resume(...)` missing registry entry | `durable_agent.resume_rejected` | Resume request cannot be fulfilled without registry state. |
| `agent/durable/durable-agent.ts:602` | `run.resume(...)` | `durable_agent.resume_started`, `durable_agent.resume_failed` | Suspended durable workflow is continued with external resume data. |
| `agent/durable/durable-agent.ts:650` | `observe(...)` | `durable_agent.observe_started`, `durable_agent.observe_ready` | Reconnect/observe is explicitly supported and should be distinguishable from first stream. |
| `agent/durable/durable-agent.ts:737` | `#clearPubsubTopic(...)` | `durable_agent.pubsub_topic_cleared` | Cached stream events are deleted during cleanup. |
| `agent/durable/durable-agent.ts:777` | `streamUntilIdle(...)` | `durable_agent.until_idle_started`, `durable_agent.until_idle_completed` | Durable long-running agent loop spans multiple continuations/background tasks. |
| `agent/durable/evented-agent.ts:71` | fire-and-forget execution | `evented_agent.execution_dispatched`, `evented_agent.execution_dispatch_failed` | Evented mode intentionally decouples caller from durable workflow completion. |
| `agent/durable/run-registry.ts` | register/get/cleanup paths | `durable_agent.registry_lookup`, `durable_agent.registry_cleaned` | Registry state controls resume/observe behavior and is otherwise invisible. |
| `agent/durable/stream-adapter.ts` | PubSub-to-stream adapter events | `durable_agent.stream_event_received`, `durable_agent.stream_event_replayed` | Durable streams depend on cached event replay and live delivery. |
| `agent/durable/workflows/create-durable-agentic-workflow.ts:330` | final finish event | `durable_agent.finished` | Workflow maps final state to streamed output and emits finish. |
| `agent/durable/workflows/create-durable-agentic-workflow.ts:340` | fire-and-forget scorers | `durable_agent.scorers_dispatched`, `durable_agent.scorer_dispatch_failed` | Scorers are intentionally non-blocking and errors are logged/skipped. |
| `agent/durable/workflows/steps/tool-call.ts:221` | approval check | `durable_tool.approval_required`, `durable_tool.approval_resolved` | Durable tool calls can suspend before execution for approval. |
| `agent/durable/workflows/steps/tool-call.ts:314` | in-execution suspend callback | `durable_tool.suspend_requested`, `durable_tool.suspended` | Tool code can suspend the durable workflow mid-execution. |
| `agent/durable/workflows/steps/tool-call.ts:397` | background config resolution | `durable_tool.background_decision` | Tool can run in background, resume a suspended background task, fall back to sync, or execute inline. |
| `agent/durable/workflows/steps/tool-call.ts:590` | suspended background task resume | `durable_background_task.resume_selected`, `durable_background_task.resumed` | Resume data may continue an existing background task rather than dispatch a new one. |
| `agent/durable/workflows/steps/tool-call.ts:613` | background dispatch success | `durable_background_task.started` | Emits a chunk today; Pulse should preserve the task/tool/run relationship. |
| `agent/durable/workflows/steps/tool-call.ts:644` | `fallbackToSync` branch | `durable_background_task.fallback_to_sync` | Concurrency/dispatch fallback changes execution semantics. |
| `agent/durable/workflows/steps/tool-call.ts:655` | chunk emit failure after tool result | `durable_tool.result_emit_failed` | Tool succeeds but stream projection fails; currently only logged. |
| `agent/durable/workflows/steps/tool-call.ts:677` | chunk emit failure after tool error | `durable_tool.error_emit_failed` | Tool fails and failure projection can also fail. |
| `agent/durable/workflows/steps/background-task-check.ts:49` | running task lookup | `durable_background_task.running_checked` | Each loop iteration checks outstanding background work. |
| `agent/durable/workflows/steps/background-task-check.ts:66` | skip wait mode | `durable_background_task.wait_skipped` | `streamUntilIdle` can externalize continuation waiting. |
| `agent/durable/workflows/steps/background-task-check.ts:80` | first invocation/no timeout branch | `durable_background_task.pending_marked` | Loop records that background work remains but does not block. |
| `agent/durable/workflows/steps/background-task-check.ts:93` | wait for next task | `durable_background_task.wait_started`, `durable_background_task.wait_progress`, `durable_background_task.wait_timed_out`, `durable_background_task.wait_completed` | Long-running wait is currently only surfaced as stream chunks. |
| `agent/durable/workflows/steps/llm-execution.ts` | retry/fallback model loop | `durable_model.attempt_started`, `durable_model.retry_selected`, `durable_model.fallback_selected`, `durable_model.exhausted` | Durable model execution has retry/fallback decisions not represented as distinct current observability events. |
| `agent/durable/workflows/steps/scorer-execution.ts` | scorer lookup/execution | `durable_scorer.started`, `durable_scorer.skipped`, `durable_scorer.failed` | Scorer failures do not affect main execution, so explicit events are useful. |

Notes:

- Durable execution is a strong Pulse fit because important state changes are discrete: prepared, subscribed, started, suspended, resumed, observed, cleaned up.
- Candidate data: cleanup timeout, cached offset, retry attempt, wait timeout, running task count, replayed event count.
- Candidate attributes: durable run id, wrapped agent id, workflow id/run id, tool call id, task id, thread/resource ids.

## `loop` and non-durable agentic execution

Files inspected:

- `packages/core/src/loop/loop.ts`
- `packages/core/src/loop/server.ts`
- `packages/core/src/loop/workflows/agentic-loop/index.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/background-task-check-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/is-task-complete-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/goal-step.ts`
- `packages/core/src/loop/network/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `loop/workflows/agentic-execution/llm-execution-step.ts:462` | client tool observability carrier injection | `client_tool.carrier_injected`, `client_tool.carrier_injection_failed` | Client-executed tools receive observability context but failures are only warned. Pulse should capture the relationship handoff. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:520` | streaming tool input deltas | `client_tool.input_stream_started`, `client_tool.input_stream_completed` | Client tool args may arrive incrementally; current span can end only after args parse. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:900` | fallback model execution loop | `model.attempt_started`, `model.fallback_selected` | Active fallback model index changes and generation span is restamped, but the decision itself should be explicit. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:925` | processor retry feedback appended | `processor_retry.feedback_injected` | Retry feedback changes the next model prompt. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:930` | initial signal echoes | `agent_signal.echoed_to_stream` | Pre-run signals are surfaced to stream consumers before the model call. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:938` | pre-run signal drain before first model request | `agent_signal.pre_run_drained` | Signals queued before first model request become part of the current turn rather than a future turn. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:981` | input step processor runner | `processor.input_step_started`, `processor.input_step_completed`, `processor.input_step_failed` | Processors can alter model, settings, tools, active tools, output, and prompt content. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:1028` | model/model-settings mutation from processors | `processor.model_changed`, `processor.model_settings_changed` | Processor decision changes the model request and existing observability only updates the model span. |
| `loop/workflows/agentic-execution/llm-execution-step.ts:1048` | tools/active tools mutation from processors | `processor.tools_changed`, `processor.active_tools_changed` | Available toolset changes mid-step. |
| `loop/workflows/agentic-execution/tool-call-step.ts:266` | remove suspended/pending metadata | `tool_suspension.metadata_removed`, `tool_suspension.metadata_remove_failed` | Resume paths mutate conversation metadata and flush it to memory. |
| `loop/workflows/agentic-execution/tool-call-step.ts:314` | flush before suspension | `tool_suspension.flush_started`, `tool_suspension.flush_failed` | Suspension safety depends on memory persistence before returning suspend state. |
| `loop/workflows/agentic-execution/tool-call-step.ts:350` | provider-executed skip | `tool_execution.skipped_provider_executed` | Tool execution is skipped locally because provider already handled it. |
| `loop/workflows/agentic-execution/tool-call-step.ts:359` | active tools enforcement | `tool_execution.rejected_unavailable` | Tool call is rejected when missing or hidden by `activeTools`. |
| `loop/workflows/agentic-execution/tool-call-step.ts:379` | `onInputAvailable` hook | `tool_hook.input_available_started`, `tool_hook.input_available_failed` | User tool hook boundary is only logged on failure. |
| `loop/workflows/agentic-execution/tool-call-step.ts:450` | global approval policy evaluation | `tool_approval.global_policy_evaluated`, `tool_approval.global_policy_failed` | Function-valued approval policy can throw and defaults to approval. |
| `loop/workflows/agentic-execution/tool-call-step.ts:466` | per-tool approval policy evaluation | `tool_approval.tool_policy_evaluated`, `tool_approval.tool_policy_failed` | Per-tool policy overrides global/flag decision and can throw. |
| `loop/workflows/agentic-execution/tool-call-step.ts` | approval-required branch | `tool_approval.required`, `tool_approval.suspended`, `tool_approval.resolved` | Tool approval is a first-class execution decision currently represented in stream chunks/suspend data. |
| `loop/workflows/agentic-execution/tool-call-step.ts` | in-execution `suspend(...)` callback | `tool_suspension.requested`, `tool_suspension.suspended` | Tool can pause the agent run for non-approval reasons. |
| `loop/workflows/agentic-execution/tool-call-step.ts:650` | suspended sub-agent/workflow run id lookup | `tool_resume.run_id_lookup_started`, `tool_resume.run_id_resolved`, `tool_resume.run_id_missing` | Resume data may need recovered child run id from metadata or data parts. |
| `loop/workflows/agentic-execution/tool-call-step.ts:714` | FGA authorization check | `tool_authz.checked`, `tool_authz.denied`, `tool_authz.allowed` | Authz gate before tool execution is a security-sensitive decision. |
| `loop/workflows/agentic-execution/tool-call-step.ts:741` | background dispatch enabled check | `tool_background.decision_started`, `tool_background.disabled` | Background execution can be disabled at agent level even if manager exists. |
| `loop/workflows/agentic-execution/tool-call-step.ts:748` | `resolveBackgroundConfig(...)` | `tool_background.decision` | Decides inline vs background, timeouts, retries, and LLM override handling. |
| `loop/workflows/agentic-execution/tool-call-step.ts:817` | background chunk transform queue | `tool_background.chunk_transformed`, `tool_background.chunk_transform_failed` | Background task lifecycle chunks are converted into inline tool-call/result/error chunks. |
| `loop/workflows/agentic-execution/tool-call-step.ts:920` | background result injector | `tool_background.result_injected`, `tool_background.result_inject_fallback` | Background results update existing tool invocation or append fallback messages. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1047` | background execution injector | `tool_background.execution_injected` | Marks background task as started/suspended in message metadata. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1101` | suspended background task check/resume | `tool_background.suspension_checked`, `tool_background.resumed` | Existing suspended background task can be resumed instead of dispatching a new one. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1120` | background dispatch success | `tool_background.started` | Agent returns a placeholder result while task continues elsewhere. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1145` | fallback-to-sync branch | `tool_background.fallback_to_sync` | Concurrency limit or dispatch policy changes the execution path. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1148` | synchronous tool execute | `tool_execution.started`, `tool_execution.completed`, `tool_execution.failed` | Existing spans cover traditional tracing, but Pulse should likely expose tool execution as atomic points. |
| `loop/workflows/agentic-execution/tool-call-step.ts:1152` | `onOutput` hook | `tool_hook.output_started`, `tool_hook.output_failed` | User hook after tool success can fail without failing the tool result. |
| `loop/workflows/agentic-execution/background-task-check-step.ts` | running background task polling | `background_task.running_checked`, `background_task.wait_started`, `background_task.wait_progress`, `background_task.wait_timed_out`, `background_task.wait_completed` | Non-durable loop mirrors durable background wait behavior. |
| `loop/workflows/agentic-execution/signal-drain-step.ts` | pending signal drain | `agent_signal.drain_started`, `agent_signal.drained`, `agent_signal.drain_skipped` | Signals sent to active runs are intentionally converted into later turns. |
| `loop/workflows/agentic-execution/is-task-complete-step.ts` | task completion decision | `agent_loop.task_completion_evaluated` | Loop continuation/termination is a decision separate from any model/tool event. |
| `loop/workflows/agentic-execution/goal-step.ts` | goal processing | `agent_goal.evaluated`, `agent_goal.completed`, `agent_goal.continued` | Goal/subgoal loop state changes should be visible as decision pulses. |
| `loop/network/run-command-tool.ts` | network command tool execution | `agent_network.command_started`, `agent_network.command_completed`, `agent_network.command_failed` | Multi-agent network command tool is a boundary outside a single agent step. |
| `loop/network/validation.ts` | network validation | `agent_network.validation_failed` | Invalid network specs/config should be structured. |

Notes:

- Many non-durable loop events are currently UI stream chunks or span updates. Pulse should distinguish “we projected this to the stream” from “this happened in execution”.
- Candidate data: model attempt, fallback index, pending signal count, background running count, approval policy latency, transformed payload size.
- Candidate attributes: agent id, run id, step id, model id/provider, processor id, tool name/call id, approval source, FGA actor/resource.

## `processors`

Files inspected:

- `packages/core/src/processors/index.ts`
- `packages/core/src/processors/runner.ts`
- `packages/core/src/processors/send-signal.ts`
- `packages/core/src/processors/prefill-error-handler.ts`
- `packages/core/src/processors/provider-history-compat.ts`
- `packages/core/src/processors/stream-error-retry-processor.ts`
- `packages/core/src/processors/trailing-assistant-guard.ts`
- `packages/core/src/processors/tool-result-reminder.ts`
- `packages/core/src/processors/processors/*`
- `packages/core/src/processors/memory/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `processors/runner.ts:55` | `invokeOnViolation(...)` | `processor.violation_callback_started`, `processor.violation_callback_failed` | `onViolation` is explicitly swallowed on failure; Pulse should expose it. |
| `processors/runner.ts:575` | `runProcessInput(...)` | `processor.input_started`, `processor.input_completed`, `processor.input_failed` | Input processors can rewrite/block the full prompt input. |
| `processors/runner.ts:744` | `runProcessOutputStream(...)` | `processor.output_stream_part_started`, `processor.output_stream_part_completed`, `processor.output_stream_part_blocked` | Stream processors can transform, drop, or block individual chunks. |
| `processors/runner.ts:1019` | streamed tripwire enqueue path | `processor.tripwire_streamed` | A processor abort is converted into a stream part before closing the stream. |
| `processors/runner.ts:1085` | `runProcessOutputResult(...)` | `processor.output_result_started`, `processor.output_result_completed`, `processor.output_result_failed` | Final output processors can filter/rewrite persisted messages. |
| `processors/runner.ts:1321` | `runProcessInputStep(...)` | `processor.input_step_started`, `processor.input_step_completed`, `processor.input_step_failed` | Step processors can change model, tools, active tools, provider options, model settings, and structured output. |
| `processors/runner.ts:1606` | `runProcessLLMRequest(...)` | `processor.llm_request_started`, `processor.llm_request_completed`, `processor.llm_request_blocked` | Processor hook can intercept provider request, including cache hit behavior. |
| `processors/runner.ts:1689` | `runProcessLLMResponse(...)` | `processor.llm_response_started`, `processor.llm_response_completed`, `processor.llm_response_failed` | Hook runs after live or cached model response, often for response cache writes. |
| `processors/runner.ts:1783` | `runProcessOutputStep(...)` | `processor.output_step_started`, `processor.output_step_completed`, `processor.output_step_blocked` | Per-step self-correction can call `abort({ retry: true })`. |
| `processors/runner.ts:1993` | `runProcessAPIError(...)` | `processor.api_error_started`, `processor.api_error_retry_selected`, `processor.api_error_retry_declined` | Error processors can request retry after failed model calls. |
| `processors/send-signal.ts:11` | `createProcessorSendSignal(...)` | `processor_signal.created`, `processor_signal.written_to_stream` | Processor-created signals become both prompt messages and stream data parts. |
| `processors/prefill-error-handler.ts:58` | known prefill error handling | `processor.prefill_error_detected`, `processor.prefill_retry_signal_sent` | Reactive retry for provider prefill errors is currently implicit inside processor behavior. |
| `processors/provider-history-compat.ts:378` | provider history compatibility error handling | `processor.provider_history_compat_retry_selected` | Reactive compatibility fix can retry after provider-specific history errors. |
| `processors/stream-error-retry-processor.ts:135` | stream/API error retry | `processor.stream_error_retry_selected`, `processor.stream_error_retry_declined` | Retry strategy should expose matched error/retry count. |
| `processors/trailing-assistant-guard.ts` | trailing assistant guard | `processor.trailing_assistant_guard_applied`, `processor.trailing_assistant_guard_skipped` | Prevents known provider errors by modifying/guarding prompt shape. |
| `processors/tool-result-reminder.ts:263` | AGENTS/instruction reminder injection | `processor.tool_result_reminder_injected`, `processor.tool_result_reminder_skipped` | Detects tool calls touching instruction files and injects reminder signals/system content. |
| `processors/processors/cost-guard.ts:271` | cost threshold check | `processor.cost_guard_checked`, `processor.cost_guard_warned`, `processor.cost_guard_blocked` | Reads metric aggregate and may abort before a model call. |
| `processors/processors/prompt-injection-detector.ts:148` | prompt injection detection | `processor.prompt_injection_detected`, `processor.prompt_injection_blocked`, `processor.prompt_injection_filtered`, `processor.prompt_injection_rewritten`, `processor.prompt_injection_warned` | Security processor uses model-based detection and strategy-specific handling. |
| `processors/processors/pii-detector.ts:798` | streaming PII detection | `processor.pii_detected`, `processor.pii_blocked`, `processor.pii_filtered`, `processor.pii_redacted`, `processor.pii_warned` | PII handling changes stream/content visibility. |
| `processors/processors/language-detector.ts:207` | language detection/translation | `processor.language_detected`, `processor.language_translated`, `processor.language_blocked`, `processor.language_warned` | Detection agent result changes message metadata/content or aborts. |
| `processors/processors/moderation.ts` | moderation strategy | `processor.moderation_flagged`, `processor.moderation_blocked`, `processor.moderation_warned` | Safety decision should be structured. |
| `processors/processors/regex-filter.ts:305` | regex input/output filtering | `processor.regex_matched`, `processor.regex_blocked`, `processor.regex_redacted`, `processor.regex_warned` | Zero-cost detector can abort or redact based on named rules. |
| `processors/processors/response-cache.ts` | LLM response cache | `processor.response_cache_hit`, `processor.response_cache_miss`, `processor.response_cache_written`, `processor.response_cache_write_failed` | Cache replay changes whether a model call occurs. |
| `processors/processors/tool-search.ts` | dynamic tool search | `processor.tool_search_started`, `processor.tool_search_completed`, `processor.tools_injected` | Processor can alter available tools for the next model step. |
| `processors/processors/tool-call-filter.ts` | tool call filtering | `processor.tool_call_filtered`, `processor.tool_call_allowed` | Controls which tool calls survive output-step processing. |
| `processors/processors/tool-search-stores.ts` | tool search store reads | `processor.tool_search_store_queried`, `processor.tool_search_store_failed` | External/dynamic store boundary. |
| `processors/processors/skill-search.ts:236` | skill meta-tool injection | `processor.skill_search_tools_injected` | Adds `search_skills`/`load_skill` meta-tools. |
| `processors/processors/skill-search.ts:283` | skill search meta-tool execution | `skill_search.queried`, `skill_search.completed`, `skill_search.failed` | Search result count and min-score decisions should be observable. |
| `processors/processors/skill-search.ts:355` | skill load meta-tool execution | `skill_search.skill_loaded`, `skill_search.skill_load_failed` | Loading a skill changes prompt/tool behavior. |
| `processors/processors/message-selection.ts` | message pruning/selection | `processor.messages_selected`, `processor.messages_dropped` | Context window shaping decision. |
| `processors/processors/structured-output.ts` | structured output configuration | `processor.structured_output_selected`, `processor.structured_output_failed` | Changes generation mode and schema. |
| `processors/processors/batch-parts.ts` | stream chunk batching | `processor.stream_parts_batched`, `processor.stream_parts_flushed` | Alters stream timing/shape. |
| `processors/processors/workspace-instructions.ts:62` | workspace instruction injection | `processor.workspace_instructions_injected`, `processor.workspace_instructions_skipped` | Workspace context can add instructions per step. |
| `processors/memory/message-history.ts:91` | memory context lookup | `memory_history.context_missing`, `memory_history.context_resolved` | Memory processor may skip entirely when no thread/resource context exists. |
| `processors/memory/message-history.ts:112` | historical message load | `memory_history.recall_started`, `memory_history.recall_completed`, `memory_history.recall_failed` | Fetches and merges recent thread messages. |
| `processors/memory/message-history.ts:175` | persistence filter | `memory_history.persistence_filtered` | Removes system messages, partial tool calls, working-memory tags, and working-memory tool args. |
| `processors/memory/message-history.ts` | output persistence | `memory_history.save_started`, `memory_history.save_completed`, `memory_history.save_skipped`, `memory_history.save_failed` | Persists new messages after output processing. |
| `processors/memory/semantic-recall.ts` | semantic recall flow | `semantic_recall.embedding_cache_hit`, `semantic_recall.embedding_created`, `semantic_recall.search_started`, `semantic_recall.search_completed`, `semantic_recall.context_injected` | Retrieves vector-similar past messages and injects them into prompt context. |
| `processors/memory/working-memory.ts:96` | missing memory context skip | `working_memory.context_missing` | Processor silently skips when no thread/resource is available. |
| `processors/memory/working-memory.ts:106` | scope-based retrieval | `working_memory.loaded`, `working_memory.load_failed` | Retrieves thread/resource scoped working memory. |
| `processors/memory/working-memory.ts:120` | dynamic template provider | `working_memory.template_resolved`, `working_memory.template_resolve_failed` | Template can be dynamic per memory config. |
| `processors/memory/working-memory.ts:137` | instruction selection | `working_memory.instruction_selected`, `working_memory.instruction_injected` | Chooses read-only/vNext/legacy instruction shape. |

Notes:

- Processor Pulse candidates are mostly `decision`, `input`, `output`, and `error` events rather than spans.
- Candidate data: message count before/after, chunk count, detection count, retry count, cache hit age, selected message count, token estimates.
- Candidate attributes: processor id/name, phase, strategy, rule/category names, model/provider for detector agents, scope, thread/resource ids.

## `workflows`

Files inspected:

- `packages/core/src/workflows/workflow.ts`
- `packages/core/src/workflows/execution-engine.ts`
- `packages/core/src/workflows/handlers/entry.ts`
- `packages/core/src/workflows/handlers/step.ts`
- `packages/core/src/workflows/handlers/control-flow.ts`
- `packages/core/src/workflows/handlers/sleep.ts`
- `packages/core/src/workflows/evented/workflow.ts`
- `packages/core/src/workflows/evented/execution-engine.ts`
- `packages/core/src/workflows/evented/step-executor.ts`
- `packages/core/src/workflows/evented/workflow-event-processor/index.ts`
- `packages/core/src/workflows/scheduler/scheduler.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `workflows/workflow.ts` | workflow run creation/start | `workflow.run_created`, `workflow.run_started` | Workflow execution begins and gets run/input/context identity. |
| `workflows/workflow.ts` | resume entrypoint | `workflow.resume_requested`, `workflow.resume_started`, `workflow.resume_rejected` | Resume can fail from missing/invalid snapshot, label/path, or state. |
| `workflows/workflow.ts` | cancel path | `workflow.cancel_requested`, `workflow.cancelled` | Cancellation is an external command plus state transition. |
| `workflows/execution-engine.ts` | durable operation wrapper | `workflow.durable_operation_started`, `workflow.durable_operation_completed`, `workflow.durable_operation_failed` | Idempotent/durable operation boundaries determine whether effects repeat. |
| `workflows/handlers/entry.ts:135` | `persistStepUpdate(...)` | `workflow.snapshot_persisted`, `workflow.snapshot_persist_failed` | Persists step result, suspended paths, resume labels, and tracing context. |
| `workflows/handlers/entry.ts:218` | `executeEntry(...)` dispatch | `workflow.entry_started`, `workflow.entry_completed`, `workflow.entry_failed` | Entry dispatch selects step/parallel/conditional/loop/foreach/sleep behavior. |
| `workflows/handlers/entry.ts:288` | resume through parallel entry | `workflow.resume_path_entered` | Resume path mutates through nested entries. |
| `workflows/handlers/entry.ts:353` | resume through conditional entry | `workflow.conditional_resume_path_entered` | Conditional resume skips re-evaluation and targets prior branch path. |
| `workflows/handlers/entry.ts:523` | sleep waiting/result events | `workflow.sleep_waiting`, `workflow.sleep_completed` | Sleep/sleepUntil are durable waiting states, not normal compute. |
| `workflows/handlers/entry.ts:738` | abort signal after entry execution | `workflow.entry_cancelled` | Entry result is converted to canceled if abort signal fired. |
| `workflows/handlers/control-flow.ts` | parallel branch execution | `workflow.parallel_started`, `workflow.parallel_completed`, `workflow.parallel_branch_failed`, `workflow.parallel_suspended` | Branch fanout/aggregation determines workflow status. |
| `workflows/handlers/control-flow.ts:381` | conditional evaluation error | `workflow.condition_failed` | User condition errors are caught, logged, span-marked, then branch is skipped. |
| `workflows/handlers/control-flow.ts:425` | conditional selected steps update | `workflow.condition_selected` | Branch selection is a core decision. |
| `workflows/handlers/control-flow.ts` | loop/foreach iteration | `workflow.loop_iteration_started`, `workflow.loop_iteration_completed`, `workflow.foreach_iteration_started`, `workflow.foreach_iteration_suspended` | Iteration boundaries should be observable independent of step spans. |
| `workflows/handlers/step.ts` | step execution | `workflow.step_started`, `workflow.step_completed`, `workflow.step_failed`, `workflow.step_suspended`, `workflow.step_bailed`, `workflow.step_paused` | Current spans exist, but Pulse should represent each terminal step state as an atomic observation. |
| `workflows/handlers/step.ts` | retry handling | `workflow.step_retry_scheduled`, `workflow.step_retry_exhausted` | Retry policy decisions are currently embedded in step result handling. |
| `workflows/evented/step-executor.ts:137` | workflow step span creation | `evented_workflow.step_started` | Evented engine recreates per-step spans manually; Pulse should record the event directly. |
| `workflows/evented/step-executor.ts:172` | `setState(...)` capture | `evented_workflow.step_state_updated` | State is captured during step and applied after completion. |
| `workflows/evented/step-executor.ts:181` | `suspend(...)` callback | `evented_workflow.step_suspend_requested`, `evented_workflow.step_suspended` | Step code can suspend with resume labels and foreach index metadata. |
| `workflows/evented/step-executor.ts:211` | `bail(...)` callback | `evented_workflow.step_bailed` | Bailing is distinct from success/failure/suspend. |
| `workflows/evented/step-executor.ts:223` | writer/tool stream for workflow step | `evented_workflow.step_stream_started` | Step can emit output chunks via `ToolStream`. |
| `workflows/evented/step-executor.ts:255` | final result mapping | `evented_workflow.step_status_selected` | Maps suspended/bailed/paused/success state after user step returns. |
| `workflows/evented/workflow-event-processor/index.ts` | event handle entry | `workflow_event.received`, `workflow_event.handled`, `workflow_event.failed` | Core event processor transforms pubsub events into workflow state transitions. |
| `workflows/evented/workflow-event-processor/index.ts:2559` | poison event budget | `workflow_event.retry_exhausted`, `workflow_event.poisoned` | Prevents infinite retries and can trigger workflow failure. |
| `workflows/evented/workflow-event-processor/index.ts:2639` | ack failure | `workflow_event.ack_failed` | Transport ack failure is only logged. |
| `workflows/evented/workflow-event-processor/index.ts:2654` | canceled workflow guard | `workflow_event.ignored_cancelled_workflow` | Non-terminal events are ignored after cancellation. |
| `workflows/evented/workflow-event-processor/index.ts:2719` | workflow start/resume event | `evented_workflow.started`, `evented_workflow.resumed` | Evented lifecycle begins through pubsub, not direct function call. |
| `workflows/evented/workflow-event-processor/index.ts:2148` | aggregated foreach suspend | `evented_workflow.foreach_suspended` | Multiple suspended iterations are aggregated into one workflow suspend. |
| `workflows/evented/workflow-event-processor/index.ts:2264` | per-step suspended watch event | `evented_workflow.step_suspended_event_published` | Emits both per-step watch event and workflow-level suspend. |
| `workflows/evented/workflow-event-processor/index.ts:2350` | workflow suspend publish | `evented_workflow.suspended` | Persists suspended paths/resume labels/tracing context and publishes suspend. |
| `workflows/evented/workflow-event-processor/index.ts:2455` | next step publish | `evented_workflow.next_step_scheduled` | The processor decides and publishes the next executable step. |
| `workflows/scheduler/scheduler.ts` | schedule tick/list/claim/publish path | `workflow_scheduler.tick_started`, `workflow_scheduler.run_claimed`, `workflow_scheduler.run_published`, `workflow_scheduler.run_failed` | Scheduled workflow dispatch involves durable listing/claiming/publishing and ghost cleanup. |
| `workflows/scheduler/scheduler.ts` | cron validation | `workflow_schedule.validated`, `workflow_schedule.invalid` | Schedule definitions can fail before runtime. |

Notes:

- Workflow Pulse events should emphasize state changes and decisions, not duration. Durations can be derived from paired start/end pulses.
- Candidate data: retry attempt, branch count, selected branch count, foreach index, sleep target timestamp, event retry count, snapshot size.
- Candidate attributes: workflow id, run id, step id, entry type, execution path, resume label, schedule id, event id/type.

## `stream`

Files inspected:

- `packages/core/src/stream/RunOutput.ts`
- `packages/core/src/stream/caching-transform-stream.ts`
- `packages/core/src/stream/base/output-format-handlers.ts`
- `packages/core/src/stream/base/base.ts`
- `packages/core/src/stream/base/consume-stream.ts`
- `packages/core/src/stream/aisdk/v4/*`
- `packages/core/src/stream/aisdk/v5/*`
- `packages/core/src/stream/aisdk/v6/*`
- `packages/core/src/stream/MastraWorkflowStream.ts`
- `packages/core/src/stream/MastraAgentNetworkStream.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `stream/RunOutput.ts:69` | workflow stream start chunk | `stream.workflow_started` | RunOutput emits workflow-start and buffers chunks. |
| `stream/RunOutput.ts:82` | write path | `stream.chunk_written`, `stream.chunk_buffered` | Stream chunks are buffered/emitted and usage is aggregated. |
| `stream/RunOutput.ts` | finish/error promise resolution | `stream.finished`, `stream.failed` | Consumers wait on delayed promises for output/usage/error. |
| `stream/caching-transform-stream.ts:70` | chunk cache write | `stream_cache.write_started`, `stream_cache.write_failed` | Cache write failures are silently ignored. |
| `stream/caching-transform-stream.ts:83` | cached history lookup | `stream_cache.history_loaded`, `stream_cache.history_load_failed` | Reconnect/replay depends on cached chunks. |
| `stream/caching-transform-stream.ts:150` | replay stream history phase | `stream_replay.history_started`, `stream_replay.history_completed` | History chunks are emitted before live stream. |
| `stream/caching-transform-stream.ts:167` | live stream phase | `stream_replay.live_started`, `stream_replay.live_completed`, `stream_replay.live_failed` | Reconnect stream switches from replay to live source. |
| `stream/base/output-format-handlers.ts:167` | structured output validation | `structured_output.validation_failed`, `structured_output.validation_warned`, `structured_output.validation_fallback` | Validation errors can warn, emit fallback, or emit error chunks. |
| `stream/base/output-format-handlers.ts:608` | object streaming parser | `structured_output.object_emitted`, `structured_output.parse_failed` | Text deltas are accumulated into object chunks. |
| `stream/base/output-format-handlers.ts:721` | object-to-text array mode decision | `structured_output.array_stream_mode_selected` | Chooses complete vs incremental array output. |
| `stream/base/base.ts` | base stream consumption | `model_stream.started`, `model_stream.completed`, `model_stream.failed`, `model_stream.aborted` | Stream lifecycle is currently spread across chunks and promises. |
| `stream/base/consume-stream.ts` | consumer drain | `stream.consumed`, `stream.consume_failed` | Consuming/draining streams can fail independently from generation. |
| `stream/aisdk/v5/transform.ts:317` | finish transform | `aisdk.finish_normalized` | Finish reason and usage are normalized across provider versions. |
| `stream/aisdk/v5/transform.ts:343` | error transform | `aisdk.error_chunk_normalized` | Provider errors become Mastra error chunks. |
| `stream/aisdk/v5/transform.ts:470` | tool call transform | `aisdk.tool_call_normalized` | Provider tool-call stream shape becomes Mastra chunk shape with optional observability carrier. |
| `stream/aisdk/v5/transform.ts:591` | usage normalization | `aisdk.usage_normalized` | Token/cache/reasoning usage is converted to Mastra shape. |
| `stream/aisdk/v5/transform.ts:655` | finish reason normalization | `aisdk.finish_reason_normalized` | Raw provider finish reasons are normalized, including `tripwire` and `retry`. |
| `stream/aisdk/v5/compat/ui-message.ts:241` | unknown chunk type | `aisdk.ui_chunk_unknown` | Unknown chunk types throw during UI conversion. |
| `stream/MastraWorkflowStream.ts` | workflow stream wrapper | `workflow_stream.subscribed`, `workflow_stream.completed`, `workflow_stream.failed` | Wrapper presents workflow stream to consumers. |
| `stream/MastraAgentNetworkStream.ts` | network stream wrapper | `agent_network_stream.subscribed`, `agent_network_stream.completed`, `agent_network_stream.failed` | Multi-agent network stream wrapper has separate lifecycle. |

Notes:

- Stream Pulse events should avoid duplicating every chunk as an observability event by default. High-value events are stream lifecycle, validation/normalization decisions, cache/replay behavior, and errors.
- Candidate data: chunk count, cached history count, output bytes/chars, usage tokens, validation issue count.
- Candidate attributes: run id, stream format, output format, schema name/id, AI SDK version, provider metadata presence.

## `harness`, `worker`, `mcp`, `auth`, `storage`, `vector`, `voice`, `evals`, `mastra`

Files inspected:

- `packages/core/src/harness/*`
- `packages/core/src/harness/v1/*`
- `packages/core/src/agent-builder/ee/*`
- `packages/core/src/worker/*`
- `packages/core/src/mcp/*`
- `packages/core/src/auth/*`
- `packages/core/src/storage/*`
- `packages/core/src/storage/domains/*`
- `packages/core/src/vector/*`
- `packages/core/src/voice/*`
- `packages/core/src/evals/*`
- `packages/core/src/mastra/*`

| Area | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `harness/v1/harness.ts:226` | session creation | `harness.session_created` | Harness already emits an internal event, but not an observability event. |
| `harness/v1/session.ts:149` | wait/status lifecycle | `harness.session_wait_started`, `harness.session_wait_timed_out` | Session run status transitions (`starting`, `running`, `waiting`, `resuming`, `idle`) are central to Harness debugging. |
| `harness/v1/session.ts:175` | subagent spawn | `harness.subagent_spawn_requested`, `harness.subagent_started`, `harness.subagent_spawn_failed` | Subagent sessions are durable child execution roots with depth/compatibility constraints. |
| `harness/v1/session.ts:191` | subagent depth cap | `harness.subagent_spawn_rejected` | Spawn can be rejected due to configured depth. |
| `harness/v1/session.ts:394` | state update queue | `harness.state_update_queued`, `harness.state_updated`, `harness.state_update_failed` | Harness serializes state updates; failures can poison or delay later updates. |
| `harness/v1/session.ts:436` | model change | `harness.model_changed` | Already internal event; should be linked to session/run. |
| `harness/v1/session.ts:453` | signal/generate path | `harness.signal_started`, `harness.signal_completed`, `harness.signal_failed` | Harness sends messages through backing agent with run id and request context. |
| `harness/v1/session.ts:489` | mode change | `harness.mode_changed` | Mode selection changes agent/tools/permissions. |
| `harness/v1/session.ts:596` | skill cache retry reset | `harness.skill_load_failed`, `harness.skill_cache_reset` | Failed skill load resets cache so later calls can retry. |
| `harness/v1/session.ts:696` | runtime compatibility check | `harness.runtime_dependency_drifted` | Already named in comments as an event-worthy condition; should be first-class. |
| `harness/v1/session.ts:721` | tool approval/decline resume | `harness.tool_approval_resumed`, `harness.tool_approval_resume_failed` | Harness turns operator approval into agent resume calls. |
| `harness/v1/tools.ts:147` | task creation tool | `harness.task_created`, `harness.task_create_failed` | Built-in task tools mutate Harness state. |
| `harness/v1/tools.ts:164` | task update tool | `harness.task_updated`, `harness.task_update_failed` | Built-in task state transition. |
| `harness/v1/tools.ts:250` | subagent tool | `harness.subagent_tool_called`, `harness.subagent_tool_failed` | User/model-visible subagent tool boundary. |
| `harness/v1/tools.ts:300` | toolset composition | `harness.tools_resolved`, `harness.tool_denied`, `harness.tool_permission_deferred` | Combines agent tools, built-ins, mode overrides, permission rules, disabled tools. |
| `agent-builder/ee/picker.ts:81` | allowlist resolution | `agent_builder.allowlist_resolved`, `agent_builder.allowlist_warning` | Unknown IDs become warnings and visible tool/agent/workflow sets. |
| `agent-builder/ee/normalize-candidate.ts` | runtime model candidate normalization | `agent_builder.model_candidate_normalized`, `agent_builder.model_candidate_rejected` | Runtime model allowlist/normalization decisions affect generated agents. |
| `worker/worker.ts` | worker lifecycle | `worker.initialized`, `worker.started`, `worker.stopped`, `worker.start_rejected` | Workers own background task, scheduler, and orchestration processing. |
| `worker/transport/pull-transport.ts:20` | pull transport start | `worker_transport.subscribed`, `worker_transport.duplicate_start_ignored` | Duplicate start is intentionally ignored and logs only in debug. |
| `worker/transport/pull-transport.ts:30` | router rejection | `worker_transport.route_failed`, `worker_transport.event_nacked` | Route errors should nack and be observable. |
| `worker/strategies/in-process-strategy.ts:23` | local step execution | `worker_step.in_process_started`, `worker_step.in_process_failed` | Worker executes evented workflow steps in-process. |
| `worker/strategies/http-remote-strategy.ts:57` | remote step execution | `worker_step.remote_started`, `worker_step.remote_completed`, `worker_step.remote_failed`, `worker_step.remote_aborted` | Standalone worker calls remote step endpoint over HTTP. |
| `worker/workers/background-task-worker.ts:100` | background task worker start/stop | `background_task_worker.started`, `background_task_worker.stopped`, `background_task_worker.start_failed` | Worker bootstraps task manager and recovered tasks. |
| `worker/workers/scheduler-worker.ts` | scheduler worker lifecycle | `scheduler_worker.started`, `scheduler_worker.stopped`, `scheduler_worker.tick_failed` | Runs schedule loop outside direct requests. |
| `worker/workers/orchestration-worker.ts` | orchestration worker lifecycle | `orchestration_worker.started`, `orchestration_worker.stopped`, `orchestration_worker.event_failed` | Owns workflow event processing. |
| `mcp/index.ts:117` | server registration | `mcp_server.registered`, `mcp_server.registration_skipped_duplicate`, `mcp_server.registration_failed` | MCP tools/agents/workflows auto-register into Mastra, with duplicate handling. |
| `mcp/index.ts:204` | transport start methods | `mcp_server.stdio_started`, `mcp_server.sse_started`, `mcp_server.http_started`, `mcp_server.start_failed` | MCP server startup transport boundaries. |
| `mcp/index.ts:306` | tool execution abstraction | `mcp_tool.execute_started`, `mcp_tool.execute_completed`, `mcp_tool.execute_failed` | Remote/exposed tool execution boundary. |
| `auth/ee/fga-check.ts` | FGA check helper | `authz.fga_check_started`, `authz.fga_allowed`, `authz.fga_denied`, `authz.fga_failed` | Security decision reused by tool execution and likely server routes. |
| `auth/defaults/session/*` | session cookie/memory providers | `auth.session_created`, `auth.session_loaded`, `auth.session_invalid`, `auth.session_destroyed` | Auth/session lifecycle should be visible when server auth is enabled. |
| `storage/filesystem-db.ts:27` | filesystem storage init | `storage.filesystem_initialized`, `storage.filesystem_init_failed` | Creates directories and initializes storage cache. |
| `storage/filesystem-db.ts:67` | corrupted file fallback | `storage.filesystem_corrupt_file_ignored` | Corruption is swallowed by starting fresh. |
| `storage/filesystem-db.ts:106` | path traversal guard | `storage.path_rejected` | Security-sensitive storage path rejection. |
| `storage/domains/*` | domain CRUD methods | `storage.domain_read`, `storage.domain_written`, `storage.domain_deleted`, `storage.domain_write_failed` | Domain stores back memory, harness, background tasks, skills, datasets, schedules, workflows, etc. |
| `storage/domains/observability/*` | traditional observability storage | `observability_store.span_saved`, `observability_store.log_saved`, `observability_store.metric_saved`, `observability_store.score_saved`, `observability_store.feedback_saved` | Current observability sink is itself worth auditing for Pulse storage later. |
| `vector/vector.ts:148` | index validation | `vector.index_validation_started`, `vector.index_validation_failed`, `vector.index_compatible`, `vector.index_conflict` | Existing index dimensions/metric can cause warnings/errors. |
| `vector/embed.ts` | embedding helpers | `vector.embedding_started`, `vector.embedding_completed`, `vector.embedding_failed` | Embeddings are external model/provider boundaries. |
| `vector/vector.ts` | abstract vector operations | `vector.query_started`, `vector.query_completed`, `vector.upsert_completed`, `vector.delete_completed` | Base abstraction defines core retrieval/storage operations. |
| `voice/*` | voice provider wrappers | `voice.speech_started`, `voice.speech_completed`, `voice.transcription_started`, `voice.transcription_completed`, `voice.voice_error` | Voice surfaces are external model/media boundaries but current core files mostly re-export internal implementations. |
| `evals/base.ts` | scorer execution | `scorer.run_started`, `scorer.run_completed`, `scorer.run_failed` | Scores are traditional observability today, but scorer lifecycle has useful Pulse events. |
| `evals/run/index.ts` | batch eval runs | `eval_run.started`, `eval_run.completed`, `eval_run.failed` | Evaluation run lifecycle should be distinct from individual score emission. |
| `evals/scoreTraces/*` | trace scoring workflow | `trace_scoring.started`, `trace_scoring.completed`, `trace_scoring.failed` | Reads existing traces and writes scores; bridge from observability data to evals. |
| `mastra/index.ts` | primitive registration | `mastra.agent_registered`, `mastra.workflow_registered`, `mastra.tool_registered`, `mastra.registration_failed` | Central DI/config hub controls which runtime entities exist. |
| `mastra/index.ts` | worker lifecycle orchestration | `mastra.workers_started`, `mastra.workers_stopped`, `mastra.worker_start_failed` | Mastra starts/stops registered workers. |
| `mastra/hooks.ts:21` | scoring hook storage absent | `score_hook.skipped_no_storage` | Live scorer hook can skip validation/save when storage is missing. |
| `mastra/hooks.ts:39` | scorer lookup | `score_hook.scorer_resolved`, `score_hook.scorer_missing` | Scorer may be found on agent/workflow/stored agent/global registry. |
| `mastra/hooks.ts:60` | scorer hook execution | `score_hook.started`, `score_hook.completed`, `score_hook.failed` | Hook validates, runs scorer, and saves legacy score payload. |

Notes:

- Harness is especially Pulse-shaped because it already uses domain events but does not appear integrated with traditional observability.
- Worker and MCP are recent/runtime-adjacent features with many lifecycle boundaries that are likely under-instrumented.
- Storage/vector/voice entries here are coarser than earlier sections; a deeper pass could break down each storage domain/provider individually.

## `browser`

Files inspected:

- `browser/browser.ts`
- `browser/cli-handler.ts`
- `browser/processor.ts`
- `browser/thread-manager.ts`
- `browser/recording/*`
- `browser/screencast/*`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `browser/thread-manager.ts:195` | `getManagerForThread(...)` | `browser_thread.session_requested` | Resolves or creates browser session for a thread. |
| `browser/thread-manager.ts:209` | session creation | `browser_thread.session_created` | New isolated browser session starts. |
| `browser/thread-manager.ts:224` | `destroySession(...)` | `browser_thread.session_destroyed` | Browser session lifecycle end. |
| `browser/thread-manager.ts` | saved browser state map | `browser_thread.state_saved`, `browser_thread.state_restored` | State persistence/restoration is important for debugging continuity. |
| `browser/processor.ts` | `computeStateSignal(...)` | `browser_state_signal.computed` | Browser state projected into agent context. |
| `browser/screencast/screencast-stream.ts` | reconnect path | `browser_screencast.reconnect_started`, `browser_screencast.reconnect_failed` | Screencast reconnects currently rely on logs/errors. |
| `browser/screencast/screencast-stream.ts` | frame receive/send | `browser_screencast.frame_received`, `browser_screencast.frame_dropped` | Visual stream health. |
| `browser/recording/mjpeg-avi.ts` | recording frame encode/write | `browser_recording.frame_written`, `browser_recording.completed` | Recording lifecycle and size/frame counts. |
| `browser/recording/tools.ts` | recording tool calls | `browser_recording.started`, `browser_recording.stopped` | User/model-triggered browser recording action. |
| `browser/cli-handler.ts` | CLI browser provider handling | `browser_cli.connected`, `browser_cli.failed` | External browser provider boundary. |

Notes:

- Browser sessions are long-lived stateful resources. Pulse can represent session lifecycle, state snapshots, screencast frames, and recording output as discrete observations.
- Candidate data: frame count, dropped count, reconnect count, recording bytes, session count.

## `channels`

Files inspected:

- `channels/agent-channels.ts`
- `channels/chat-driver-static.ts`
- `channels/chat-driver-streaming.ts`
- `channels/chat-lazy.ts`
- `channels/compat/slack.ts`
- `channels/formatting.ts`
- `channels/inline-media.ts`
- `channels/om.ts`
- `channels/processor.ts`
- `channels/state-adapter.ts`
- `channels/stream-helpers.ts`
- `channels/typing-status.ts`
- `channels/types.ts`

| File | Location | Candidate Pulse | Why |
| --- | --- | --- | --- |
| `channels/types.ts` | provider lifecycle interface | `channel_provider.registered`, `channel_provider.connected`, `channel_provider.disconnected` | Channel integrations have explicit lifecycle methods. |
| `channels/agent-channels.ts:1052` | sends incoming channel message to agent | `channel_message.received`, `channel_message.sent_to_agent` | Platform ingress into agent memory/thread. |
| `channels/agent-channels.ts:1137` | subscribes to agent thread | `channel_thread.subscription_started` | Per-thread channel subscription opened lazily. |
| `channels/agent-channels.ts` | thread context/history fetch | `channel_thread.context_fetched` | External platform history becomes model context. |
| `channels/agent-channels.ts` | handler override dispatch | `channel_handler.started`, `channel_handler.failed` | User-provided channel handlers are callback boundaries. |
| `channels/agent-channels.ts` | render/post outbound messages | `channel_message.rendered`, `channel_message.posted`, `channel_message.post_failed` | User-visible channel output lifecycle. |
| `channels/processor.ts` | channel context injected into prompt | `channel_context.injected` | Channel context changes model behavior. |
| `channels/inline-media.ts` | media fetch/embed decisions | `channel_media.inlined`, `channel_media.skipped`, `channel_media.failed` | External media handling affects prompt content and cost. |
| `channels/typing-status.ts` | typing/status selection | `channel_typing_status.selected`, `channel_typing_status.sent` | User-visible status changes. |
| `channels/state-adapter.ts` | channel state conversion | `channel_state.converted` | Boundary between platform state and Mastra state. |
| `channels/compat/slack.ts` | Slack compatibility adapter | `channel_slack.event_received`, `channel_slack.event_handled` | Platform-specific webhook/event handling. |
| `channels/om.ts` | observational memory channel behavior | `channel_om.started`, `channel_om.failed` | Channel-specific OM actions are mostly opaque currently. |

Notes:

- Channels are rich in Pulse `input`, `output`, and `decision` events.
- Candidate attributes: platform, channel/thread id, is DM, handler kind, message id, media content type, render mode.

## Coverage Status

Covered in this file:

- `signals`, `notifications`, `events`, `background-tasks`
- `workspace`, `workspace/tools`, `workspace/sandbox`, `tools/code-mode`
- `browser`, `channels`
- `agent/thread-stream-runtime`, `agent/save-queue`, `agent/durable`
- `loop`, `processors`, `workflows`, `stream`
- `harness`, `worker`, `mcp`, `auth`, `storage`, `vector`, `voice`, `evals`, `mastra`

Deeper follow-up has been split into continuation files:

- `07-deeper-core-pulse-candidates.md`: memory, datasets/evals, integration/provider/relevance, server/license/cache/bundler/deployer/hooks.
- `08-runtime-surfaces-pulse-candidates.md`: tools, task tools/state signals, LLM routing/transports.
- `09-storage-observability-pulse-candidates.md`: observability helpers, storage init/composition, observability storage, storage-domain method surfaces.
- `10-protocol-telemetry-adapter-pulse-candidates.md`: A2A, ToolLoopAgent, Agent Builder, telemetry, logging, and thin package boundaries.

Remaining caveats:

- Some local files are thin re-exports to `@internal/*`; this audit marks the core package boundary but does not inspect internal package implementations outside `packages/core/src`.
- Storage-domain coverage in `09` is mostly a method-surface audit. It identifies likely Pulse boundaries but does not deeply inspect every branch in every in-memory/filesystem implementation.
- Exact mapping of current UI/domain events to final Pulse `type` names is intentionally deferred.
