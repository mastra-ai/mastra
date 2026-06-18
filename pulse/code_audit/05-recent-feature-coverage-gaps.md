# Recent Feature Coverage Gaps

This pass looks for areas announced recently that have little or no traditional observability coverage in `packages/core/src`.

Sources used for feature targeting:

- Mastra blog index, especially recent posts on Code Mode, harnesses, Agent Signals, multi-user/channel agents, and enhanced workflows: <https://mastra.ai/blog>
- GitHub release notes for `@mastra/core@1.42.0` and recent releases: <https://github.com/mastra-ai/mastra/releases>

The release notes call out SignalProvider/declarative signal wiring, tool suspension and Harness suspension APIs, task tools with `threadState`, durable harness sessions, Postgres vNext observability storage, OpenAI Agents SDK tracing continuity, PubSub batching, tool hooks, and Code Mode. The blog index also calls out Code Mode, long-running harnesses, Agent Signals, multi-user/multi-channel agents, and enhanced durable workflows.

## Summary

Traditional observability is strongest around agent/model/tool/workflow span trees. It is thinner around newer orchestration surfaces that are event-driven, durable, or stateful:

- Harness event lifecycle and durable harness sessions.
- Signal providers, notification signals, and state signals.
- Sandbox lifecycle and dynamic sandbox resolution.
- Long-running `untilIdle` streams and background-task continuations.
- Durable agent/workflow suspension and resume paths.
- Code Mode runner/RPC lifecycle.
- Trusted actor / auth bypass paths.
- PubSub batching/coalescing and notification delivery.

These are good Pulse candidates because they are already point-in-time event streams, but they currently do not consistently become spans/logs/metrics.

## Harness

Relevant recent feature: the June 12 release notes mention the new Harness suspension API and durable Harness v1 sessions.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/harness/harness.ts:1893` | Calls `agent.subscribeToThread(...)` and passes tracing context where provided. | No harness-level span around subscription lifetime, reconnect, or event processing. |
| `packages/core/src/harness/harness.ts:2230` | `sendNotificationSignal(...)` delegates to agent signal APIs. | No signal send span/log/metric at harness boundary. |
| `packages/core/src/harness/harness.ts:2271` | `sendMessage(...)` starts the main user message flow. | No harness message span; downstream agent may trace, but harness queueing/display/event translation is not traced. |
| `packages/core/src/harness/harness.ts:2969` | Emits `tool_suspended` harness event. | Suspension is a UI/event signal, not an observability signal. |
| `packages/core/src/harness/harness.ts:3488` | `respondToToolSuspension(...)` resumes suspended tool execution. | No span/log/metric for resume attempt, approval latency, invalid resume payload, or concurrent suspension count. |
| `packages/core/src/harness/harness.ts:3890` | Updates display state for `tool_suspended`. | Display-state transitions are not observed except via harness listeners. |
| `packages/core/src/harness/session.ts:534` | Stores trace ID in session state. | Session-level trace ID exists, but session lifecycle itself is not traced. |
| `packages/core/src/harness/v1/session.ts:306` | Durable v1 `respondToToolSuspension(...)`. | Durable session resume path lacks explicit observability. |
| `packages/core/src/harness/v1/session.ts:448` | Durable v1 `signal(...)`. | Signal delivery into durable harness sessions lacks explicit observability. |
| `packages/core/src/harness/v1/session.ts:661` | Tracks current run/trace ID. | Trace ID propagation exists, but durable session lease/open/close/replay events are not emitted as observability signals. |
| `packages/core/src/harness/v1/tools.ts:220` | Child harness session tool returns `traceId`. | Trace IDs propagate to tool outputs, but child harness lifecycle is not traced as its own operation. |

Likely missing signal types:

- harness session opened/loaded/closed
- message queued/sent/dropped
- subscription started/reconnected/ended
- tool suspension created/resumed/expired
- display-state mutation counts
- durable session lease contention and replay

## Signals and State Signals

Relevant recent features: Agent Signals, SignalProvider, TaskSignalProvider, `threadState`, and state-signal lane.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/signals/signal-provider.ts:102` | Defines `SignalProvider`. | Provider lifecycle has no observability context or logger/metric hooks. |
| `packages/core/src/signals/signal-provider.ts:223` | Subscription registration. | Subscribe/unsubscribe operations are not traced or measured. |
| `packages/core/src/signals/signal-provider.ts:421` | Optional webhook handler. | Webhook receipt, validation, and notification fanout are not observed. |
| `packages/core/src/signals/signal-provider.ts:450` | `notify(...)` sends notification signals to agent threads. | No signal emission span/log/metric; failures throw but are not structured observability events here. |
| `packages/core/src/agent/agent.ts:7107` | Public `sendNotificationSignal(...)`. | Signal sends are agent domain events, not traditional observability events. |
| `packages/core/src/agent/thread-stream-runtime.ts:1185` | `sendStateSignal(...)`. | State-signal application lacks a span/log/metric around state load/apply/publish. |
| `packages/core/src/processors/runner.ts:381` | Calls `computeStateSignal(...)`. | State computation has no dedicated span; processor spans may exist around broader processor execution, but state-lane compute/send is not separately observable. |
| `packages/core/src/processors/runner.ts:399` | `sendStateSignal(...)` callback. | No metric/log for emitted snapshot vs delta, cache key hits, or failed thread load beyond thrown errors. |
| `packages/core/src/tools/builtin/task-tools.ts:350` | Task tools write to `threadState`. | Task state changes are not traced unless the tool call itself is traced; no task-domain metrics. |
| `packages/core/src/tools/builtin/task-state-processor.ts:197` | Computes task state signal. | No direct observability around compute result size, mode, diff-vs-snapshot, or missing store. |
| `packages/core/src/agent/goal/state-processor.ts:73` | Computes goal state signal. | Same state-signal gap for goal/objective projection. |

Likely missing signal types:

- signal provider started/stopped
- poll cycle started/completed/failed
- webhook received/accepted/rejected
- notification/state signal sent/applied/dropped
- state snapshot/delta size
- task/goal threadState read/write result

## Sandbox and Dynamic Workspace Sandboxes

Relevant recent features: cloud sandbox providers, Railway/Vercel sandbox integrations, dynamic sandbox resolution, and per-thread sandboxes.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/workspace/sandbox/mastra-sandbox.ts:226` | `_start()` lifecycle wrapper. | No sandbox lifecycle span for start/stop/destroy/status transitions. |
| `packages/core/src/workspace/sandbox/mastra-sandbox.ts:260` | `_executeStart()` sets `status = 'starting'`. | Status changes are not emitted as observability events. |
| `packages/core/src/workspace/sandbox/mastra-sandbox.ts:278` | Logs failed `onStart` callback. | Log-only through `DualLogger`; no lifecycle span or failure metric. |
| `packages/core/src/workspace/sandbox/mastra-sandbox.ts:294` | Logs pending mount processing errors. | Mount failures are logged but not structured as sandbox/mount observability events. |
| `packages/core/src/workspace/sandbox/process-manager/process-manager.ts:77` | Ensures sandbox is running before process spawn. | Spawn/list/get are not traced here; workspace tools trace command execution, but direct sandbox process API use is not. |
| `packages/core/src/workspace/sandbox/process-manager/process-manager.ts:81` | Spawns a process. | No process lifecycle span/metric for PID, command, exit, bytes, duration, abort. |
| `packages/core/src/workspace/workspace.ts:883` | Resolves dynamic sandbox cache key. | Dynamic sandbox resolver/cache hits/misses are not observable. |
| `packages/core/src/workspace/workspace.ts:912` | Clears cached resolver-backed sandboxes. | Cache eviction is not observable. |
| `packages/core/src/workspace/sandbox/mount-manager.ts:241` | Processes pending mounts. | Logs exist, but no mount lifecycle span/metric. |

Likely missing signal types:

- sandbox start/ready/error/stop/destroy
- dynamic sandbox resolver hit/miss/new/reuse
- process spawn/exit/kill/output-truncated
- mount queued/started/succeeded/failed/skipped
- sandbox provider latency and error rates

## Durable Agent and Durable Workflow

Relevant recent features: durable workflows, durable agents, durable harness sessions, tool suspension/resume, and advanced retry/replay.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/agent/durable/durable-agent.ts:437` | `DurableAgent.stream(...)` preparation starts. | No durable-agent root span around preparation, registry setup, workflow start, stream subscription, cleanup. |
| `packages/core/src/agent/durable/durable-agent.ts:470` | Creates durable agent stream. | Stream lifecycle is not traced at durable wrapper boundary. |
| `packages/core/src/agent/durable/durable-agent.ts:535` | Resumes suspended workflow execution. | Resume operation lacks explicit span/log/metric. |
| `packages/core/src/agent/durable/workflows/steps/llm-execution.ts:217` | Rebuilds model-generation span. | Model spans are handled, but durable workflow step/replay boundaries around model execution are thin. |
| `packages/core/src/agent/durable/workflows/steps/tool-call.ts:243` | Emits tool approval chunk via PubSub. | Approval event is not also an observability event. |
| `packages/core/src/agent/durable/workflows/steps/tool-call.ts:258` | Suspends for tool approval. | Suspension timing and reason are not observed except domain events. |
| `packages/core/src/agent/durable/workflows/steps/tool-call.ts:314` | In-execution suspend callback. | General tool suspension lacks observability. |
| `packages/core/src/agent/durable/workflows/steps/tool-call.ts:367` | Emits `tool-call-suspended` chunk. | Domain stream event only. |
| `packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:23` | Defines optional hooks for observability/streaming. | Partial support: hooks exist, but this shared core helper does not create spans itself. |
| `packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:88` | Calls `onToolStart`. | Depends on caller to provide observability hook. |
| `packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:97` | Calls `onToolResult`. | Depends on caller to close span/emit result. |
| `packages/core/src/agent/durable/workflows/shared/execute-tool-calls.ts:116` | Calls `onToolError`. | Depends on caller to mark span error. |
| `packages/core/src/workflows/evented/execution-engine.ts:111` | Handles terminal workflow events. | Workflow pubsub terminal events are not direct observability events. |
| `packages/core/src/workflows/evented/step-executor.ts:137` | Creates step span. | Some step tracing exists, but suspension/resume sub-events are not represented. |
| `packages/core/src/workflows/evented/step-executor.ts:255` | Builds suspended step result. | Suspension is state, not observability. |

Likely missing signal types:

- durable stream started/ready/cleanup
- durable registry insert/cleanup
- workflow start/resume/replay/suspend/fail/end
- tool approval requested/resolved/denied
- durable retry attempt and replay count
- workflow event ack/nack latency

## Long-Running Agents / `untilIdle`

Relevant recent feature: long-running agents and background-task continuations.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/agent/agent.ts:7328` | Delegates `stream(..., { untilIdle })` to idle-loop wrapper. | No wrapper-level span for the long-running stream. |
| `packages/core/src/agent/agent.ts:7651` | Delegates resume stream with `untilIdle`. | Resume-until-idle is not separately observed. |
| `packages/core/src/agent/stream-until-idle.ts:310` | Pipes inner stream chunks to outer stream. | Chunk forwarding, continuation count, and dropped duplicates are not observed. |
| `packages/core/src/agent/stream-until-idle.ts:397` | Starts background-task event stream subscription. | No span/metric for background-task stream subscription lifetime. |
| `packages/core/src/agent/stream-until-idle.ts:403` | Reads background-task events. | Background task lifecycle chunks are forwarded but not observed. |
| `packages/core/src/agent/stream-until-idle.ts:413` | Deduplicates terminal events. | No metric/log for dedupe behavior or skipped events. |
| `packages/core/src/agent/durable/durable-stream-until-idle.ts:230` | Durable version pipes inner stream. | Same gap in durable path. |
| `packages/core/src/agent/durable/durable-stream-until-idle.ts:303` | Durable background-task subscription. | Same subscription/continuation gaps. |

Likely missing signal types:

- until-idle stream started/closed/forced-closed
- idle timeout armed/fired
- background task event received/forwarded/deduped
- continuation started/completed/failed
- active stream slot acquired/replaced

## Code Mode

Relevant recent feature: Code Mode for multi-tool computations.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/tools/code-mode/runner.ts:87` | Sandbox runner emits `{ type: 'log', level, message }` frames for console calls. | These are code-mode frames, not observability logs. |
| `packages/core/src/tools/code-mode/transport.ts:62` | Spawns the sandboxed runner process. | Runner process lifecycle has no span/metric. |
| `packages/core/src/tools/code-mode/transport.ts:82` | Parses runner frames from stdout. | Frame parse errors are silently ignored. |
| `packages/core/src/tools/code-mode/transport.ts:91` | Accumulates log frames in memory. | Logs are returned in tool output, not emitted to observability. |
| `packages/core/src/tools/code-mode/transport.ts:115` | `notifyCall(...)` best-effort observer hook. | Hook exists but no built-in span/metric/log. |
| `packages/core/src/tools/code-mode/transport.ts:121` | `notifyResult(...)` includes `durationMs` and `error`. | Duration is available but not emitted to metrics/tracing in core. |

Likely missing signal types:

- code-mode program started/completed/failed/timed out
- external RPC call started/completed/failed
- runner stdout frame parse failure
- sandbox runner process exit
- code-mode log frame emitted as structured observability log

## Trusted Actor / Auth

Relevant recent feature: trusted `actor` execution for workflows, tools, memory, and agents.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/auth/ee/fga-check.ts:65` | Detects system actor shape. | No observability event for trusted actor checks. |
| `packages/core/src/auth/ee/fga-check.ts:121` | Denies trusted actor without tenant scope. | Error is thrown, but no structured auth decision signal here. |
| `packages/core/src/auth/ee/fga-check.ts:139` | Adds `source_workflow` context to FGA check. | No metric/log for actor decision, bypass, denial, or source workflow. |

Likely missing signal types:

- auth check started/completed/denied
- trusted actor accepted/denied
- missing organization ID
- source workflow attribution

## PubSub, Notifications, and Channels

Relevant recent features: PubSub batching/coalescing, notification delivery, multi-user/multi-channel agents.

| Location | Current Coverage | Gap |
| --- | --- | --- |
| `packages/core/src/events/event-emitter/index.ts:82` | Logs listener errors. | PubSub publish/subscribe delivery is not generally traced. |
| `packages/core/src/events/caching-pubsub.ts:80` | Logs cache pubsub errors. | No metric/log for cache hit/miss, replay count, dropped event, subscriber lag. |
| `packages/core/src/notifications/dispatcher.ts:122` | Checks thread state for delivery decisions. | Delivery decision is not emitted as observability. |
| `packages/core/src/notifications/delivery-policy.ts:13` | Models active/idle thread delivery policy. | Policy decisions have no signal. |
| `packages/core/src/channels/agent-channels.ts:1052` | Sends channel message into agent thread. | Channel ingress is not traced as its own operation. |
| `packages/core/src/channels/agent-channels.ts:1137` | Opens per-thread subscription. | Channel subscription lifetime is not observed. |

Likely missing signal types:

- pubsub publish/subscriber delivery started/completed/failed
- batch coalesced/flushed/dropped
- notification delivery accepted/deferred/summarized/skipped
- channel message received/queued/sent
- per-thread subscription opened/closed/reused

## Candidate Next Audit Pass

The next useful audit would be a line-level gap pass for one target area at a time. I would start with:

1. `signals` + `thread-stream-runtime` because they map naturally to Pulse events.
2. `workspace/sandbox` because lifecycle/process events are concrete and measurable.
3. durable agent/tool suspension because resume/suspend boundaries are important and currently split across PubSub chunks and workflow state.
