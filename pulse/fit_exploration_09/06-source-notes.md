# Source Notes

## Agent Controller Session

Read:

- `packages/core/src/agent-controller/session.ts`
- `packages/core/src/agent-controller/session-run-engine.ts`

Relevant source facts:

- `Session` owns transient run identity, abort control, live thread subscription, parked suspensions, follow-up queue, approval gate, selected mode/model, session permissions, and display projection.
- `SessionDisplayState` is explicitly a UI projection. It reduces raw controller events into a snapshot for UIs.
- `abortRun()` clears parked suspensions, cancels approval gates, and either aborts immediately or defers abort teardown until a declined approval lands.
- `sendSignal()` creates/binds a thread, routes to active run or idle wake, waits for post-abort idle state when needed, and can surface real delivery action when `requireDelivery` is set.
- `followUp()` queues content while a run is active; `drainFollowUpQueue()` either sends the next queued message or requeues on setup failure.
- `respondToToolApproval()` can grant a category for the rest of the session (`always_allow_category`) before approval.
- `resumeToolCall()` removes the suspension before resuming, builds current toolsets/request context, and drives `sendStreamResume`.
- `SessionRunEngine` turns stream chunks into message parts, tool lifecycle events, approval gates, suspension registration, usage updates, terminal run reasons, and fallback notices.

Pulse implications:

- Export controller/session semantic facts, not the display snapshot.
- Approval policy grants are ChangePulses with session scope.
- Approval decisions and suspensions are runtime Pulses.
- Follow-up queue facts matter because they explain why a user message was not immediately model-visible.
- Model fallback should be recorded as a model routing decision, not merely as an info message.

## Channels

Read:

- `packages/core/src/channels/agent-controller-channels.ts`
- `packages/core/src/channels/agent-channels.ts`

Relevant source facts:

- `AgentChannels.buildEventContext()` creates three shapes from the same inbound event: request context, model-visible XML attributes, and provider metadata persisted on the message.
- Inbound channel messages map external thread/message identity to a Mastra thread/resource and then enter the Agent Signal path.
- Attachments and inline links are either file parts or text descriptions depending on media support.
- Non-DM history is currently flattened into the user message text block.
- `AgentControllerChannels` routes inbound messages into a controller `Session`.
- Stale approval actions are detected before touching a session approval gate; core refuses execution and optionally calls a host hook.
- Session resolver refusal is fail-closed and can prevent session creation/model calls/output.

Pulse implications:

- External channel ids are relationships/metadata on content-introducing Pulses.
- Provider metadata is not a separate Pulse unless it affects model/provider behavior.
- Stale approvals are useful decision Pulses only when an attempted user action is ignored or settled.
- Channel rendering, subscriptions, and output adapters are not Pulse facts.

## Background Tasks

Read:

- `packages/core/src/background-tasks/manager.ts`
- `packages/core/src/background-tasks/workflow.ts`
- `packages/core/src/background-tasks/types.ts`

Relevant source facts:

- Tasks carry `taskId`, `toolName`, `toolCallId`, `agentId`, `threadId`, `resourceId`, `runId`, args, status, retry count, timeout, result/error, and suspend payload.
- Manager lifecycle publishes `task.running`, `task.output`, `task.suspended`, `task.resumed`, `task.completed`, `task.failed`, and `task.cancelled`.
- The workflow wrapper owns executor invocation, progress publishing, suspend wrapping, timeout classification, retry bookkeeping, and terminal persistence.
- `runLocalSuspendHooks` updates the agent message/list state without deregistering context; terminal hooks deregister.
- `recoverStaleTasks()` moves retryable running tasks back to pending or fails non-retryable tasks.
- Stream snapshots of existing running/suspended tasks are UI/SSE projections.

Pulse implications:

- Task lifecycle maps to Pulse facts when tied to agent/tool execution.
- Retry/recovery is a semantic state change only when it changes retry count/status/outcome.
- Pubsub publish/subscribe and snapshot stream mechanics should not be exported directly.

## File-Routed Agents And Skills

Read:

- `packages/core/src/agent/fs-routing/index.ts`
- `packages/core/src/skills/agent-skills-resolver.ts`
- `packages/core/src/processors/processors/skills.ts`

Relevant source facts:

- File-routed agents assemble config, instructions, tools, skills, workspace, memory, processors, scorers, schedules, and subagents.
- Precedence is explicit: dynamic config values usually win; `instructions.ts` beats `instructions.md`; config wins collisions for tools/skills/scorers.
- Schedules are only supported on root agents; subagent declarations are depth-limited and become delegation tools.
- Agent skills and workspace skills can merge, with agent-level skills taking precedence.
- `SkillsProcessor` refreshes skills on first step, formats deterministic skill metadata, registers location aliases, and injects system messages into `MessageList`.

Pulse implications:

- File routing is definition assembly/config provenance.
- Collision/ignored-file warnings matter only if they explain effective runtime behavior.
- Skill list/get/refresh internals should not emit by default.
- Skill metadata injection is model-visible content and should connect to the model input turn.

## Experiments And Evals

Read:

- `packages/core/src/datasets/experiment/index.ts`
- `packages/core/src/datasets/experiment/events.ts`
- `packages/core/src/datasets/experiment/scorer.ts`
- sampled `packages/core/src/evals/base.ts`

Relevant source facts:

- `runExperiment()` resolves data, target, scorers, hooks, persistence policy, request context, tool mocks, retries, item timeout, and abort signal.
- `ExperimentEventDispatcher` emits versioned, sequenced, JSON-safe `experiment.run.started`, `experiment.item.completed`, and `experiment.run.finished` events.
- Observer failures abort the experiment through an internal abort controller.
- Scorer resolution supports registry ids and stored scorers; missing item scorer ids fail the item without target execution.
- Scorer runs can use target trace/trajectory data and persist scores with experiment correlation.
- Score persistence is best-effort and should not change the target/item result.

Pulse implications:

- Existing experiment observer events are good Pulse boundaries.
- Hook start/finish/failure may need additional Pulse boundaries if hooks are in first scope.
- Score records should link to scorer definitions and target traces/flows.
- Storage progress updates, persistence failures, and analytics queries should not double-count runtime facts.

## Schedules And Workflows

Read:

- focused references in `packages/core/src/schedules/worker.ts`
- focused references in workflow runtime files

Relevant source facts:

- Agent schedule worker consumes `agent-schedule.fire`, resolves agent, prepares prompt/params through handler/hooks, sends message/signal, and records trigger outcome with run id.
- Schedule outcomes include fired/skipped/succeeded/failed/aborted-style cases.
- Workflow runtime already has explicit start/resume/restart/cancel/suspend semantics and tracing spans.
- Workflow snapshots are internal persistence used to resume and inspect runs.

Pulse implications:

- Schedule fire matters when it introduces content or starts/skips/fails a run.
- Trigger-row persistence is bookkeeping; the Pulse fact is the schedule-caused input/run outcome.
- Workflow lifecycle is already an initial Pulse domain, but snapshot storage should remain internal unless reconstruction requires a last-resort SnapshotPulse.
