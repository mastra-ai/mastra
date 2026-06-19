# Existing `resumeStream` / tool-resume architecture

This note describes the current baseline on `fix/same-run-tool-resume-subscriptions` after resetting to `bff80049cc0` (`fix: await thread stream registration`). It intentionally documents the existing narrow behavior before introducing any broader resume primitive.

## Scope

This is the direct resume path used for suspended tools and tool approval:

- `Agent.resumeStream()`
- `Agent.approveToolCall()` / `Agent.declineToolCall()`
- `Agent.sendToolApproval()`
- Harness `respondToToolSuspension()` / `handleToolResume()` / `handleToolApprove()`
- Runtime registration of resumed output into thread subscriptions

It does **not** describe a generalized subscription-native resume API, because the baseline does not have one.

## Main actors

### `Agent.resumeStream()`

Location: `packages/core/src/agent/agent.ts`

Responsibilities:

1. Merge default options with caller-provided resume options.
2. Load the agentic-loop snapshot for `runId`.
3. Rehydrate memory options from the snapshot when needed.
4. Enforce execution FGA.
5. Prepare the run for thread runtime bookkeeping via `agentThreadStreamRuntime.prepareRunOptions()`.
6. Execute the agent with `resumeContext` and `methodType: 'stream'`.
7. Register the returned `MastraModelOutput` with `agentThreadStreamRuntime.registerRun()`.
8. Return the `MastraModelOutput` to the caller.

Important detail: `resumeStream()` returns an output stream, but it also registers that stream with the thread runtime. That creates two possible consumers:

- the direct caller, if it reads the returned output;
- any thread subscription, via runtime broadcast/subscriber streams.

The Harness baseline intentionally avoids direct consumption for ordinary suspended-tool resumes so the subscription remains the only Harness consumer.

### `Agent.approveToolCall()` / `declineToolCall()`

Location: `packages/core/src/agent/agent.ts`

These are thin wrappers:

- `approveToolCall(options)` calls `resumeStream({ approved: true }, options)`.
- `declineToolCall(options)` calls `resumeStream({ approved: false }, options)`.

They return the resumed `MastraModelOutput` and preserve the original run id.

### `Agent.sendToolApproval()`

Location: `packages/core/src/agent/agent.ts`

This is the baseline subscription-aware approval helper.

Inputs include:

- `threadId`
- `resourceId`
- `approved`
- optional `toolCallId`
- optional continuation `messages`
- execution options such as `runId`, `memory`, `toolsets`, `abortSignal`, `requestContext`

Behavior:

1. If `messages` are present and approval is positive, it calls `agentThreadStreamRuntime.continueWithMessages()` instead of resuming the tool directly.
2. Otherwise it resolves the currently active run using `this.getActiveThreadRunId({ threadId, resourceId })`.
3. If no active run exists, it throws `AGENT_SEND_TOOL_APPROVAL_NO_ACTIVE_THREAD_RUN`.
4. It builds approval options using the active run id and thread/resource memory.
5. It calls `approveToolCall()` or `declineToolCall()`.
6. It returns `{ accepted: true, runId, toolCallId }` and does **not** return or consume the output stream.

Key invariant: `sendToolApproval()` expects the suspended approval run to still be discoverable as an active thread run. In the baseline, this only works for approval suspensions tracked by `approvalSuspendedRunIds`.

## Harness paths

### Generic suspended tool resume

Location: `packages/core/src/harness/harness.ts`

Flow:

1. UI calls `respondToToolSuspension({ resumeData, toolCallId })`.
2. Harness resolves the specific pending tool call through `SessionSuspensions`.
3. `submit_plan` gets special plan-mode behavior; other tools call `handleToolResume()`.
4. `handleToolResume()`:
   - reads the parked suspension (`runId`, `toolName`);
   - deletes the session/display pending suspension before resuming;
   - builds request context;
   - requires an active thread id;
   - ensures an agent/thread subscription exists;
   - calls `agent.resumeStream(resumeData, { ...shared options, runId: suspension.runId, toolCallId, memory, abortSignal, requestContext, toolsets })`;
   - does **not** consume the returned stream.

The comment in `handleToolResume()` is the central baseline contract:

> Thread subscriptions are the sole consumer for harness agent output. Resumed tools reuse the suspended runId, so consuming the returned stream here would race or duplicate the subscription stream and leave other subscribers behind.

### Tool approval buttons

Location: `packages/core/src/harness/harness.ts`

`handleToolApprove()` / `handleToolDecline()` differ from generic `handleToolResume()`:

- They read `runId` from `session.run.getRunId()`.
- They call `agent.sendToolApproval()`.
- They pass `threadId`, `resourceId`, `approved`, `runId`, `toolCallId`, approval settings, memory, abort signal, request context, and toolsets.

The important baseline fix is that approval uses `sendToolApproval()`, which is designed to attach to the active thread subscription, instead of directly consuming a returned resume stream in the Harness.

## Session state involved in resume

Location: `packages/core/src/harness/session.ts`

### `SessionStream`

Owns the current thread subscription handle:

- `attach()` stores subscription + key.
- `matches()` allows reusing a subscription for the same `(agent, resource, thread)`.
- `activeRunId()` delegates to `subscription.activeRunId()`.
- `isActive()` is true when `activeRunId()` is not null.
- `cleanup()` aborts and unsubscribes.

### `SessionSuspensions`

Owns parked tool suspensions keyed by `toolCallId`:

- stores `{ runId, toolName }`;
- lets Harness resolve which suspended tool to resume;
- does not own UI display state or stream consumption.

## Runtime support for resumed streams

Location: `packages/core/src/agent/thread-stream-runtime.ts`

### Run identity

Runtime state has:

- `threadRunsById`: run id -> local run record;
- `threadKeysByRunId`: run id -> `(resource, thread)` key;
- `activeThreadRunIds`: thread key -> active run id;
- `approvalSuspendedRunIds`: run ids suspended on `tool-call-approval`;
- `watchedThreadRunIds`: run ids with an active completion watcher.

### `registerRun()`

When `resumeStream()` returns a new output, it calls `registerRun()`.

`registerRun()`:

1. Resolves thread/resource from run options.
2. Wraps output in `#withBroadcastStream()`.
3. Creates a run record with the same `output.runId`.
4. Stores `threadRunsById`, `threadKeysByRunId`, and `activeThreadRunIds`.
5. Publishes `run-registered` and waits for that publish to complete.
6. Starts broadcast after registration publish settles.
7. Starts the completion watcher.

Baseline same-run resume behavior depends on this: a resumed stream re-registers the same run id, and subscribers delete the run id from their `seenRunIds` on `run-registered` so they can consume the resumed output as a new stream boundary.

### `#withBroadcastStream()`

This is the runtime multicast wrapper:

- reads `output.fullStream` once;
- buffers emitted parts in `parts`;
- publishes each part as `stream-part` to PubSub;
- exposes `createSubscriberStream()` so each subscriber gets its own reader over buffered/live parts.

When it sees `tool-call-approval`, it adds the run id to `approvalSuspendedRunIds`.

Important risk: because `#withBroadcastStream()` reads `output.fullStream`, direct consumption of the same output by the original caller can conflict with subscription consumption unless the output is safely multicast. The Harness avoids that by not reading returned resume outputs.

### `#watchThreadRunCompletion()`

The completion watcher waits for `output._waitUntilFinished()`.

If the output status is `suspended` and the run is in `approvalSuspendedRunIds`:

- it publishes `run-suspended`;
- it keeps runtime records around;
- it leaves the run discoverable as thread-blocking through `approvalSuspendedRunIds`.

Otherwise it:

- clears approval-suspended state;
- deletes `threadRunsById` and `threadKeysByRunId`;
- clears `activeThreadRunIds` if this run still owns the thread;
- publishes `run-completed`;
- drains pending signals / continuations / idle signals.

## Subscriber handling for resumed runs

Location: `packages/core/src/agent/thread-stream-runtime.ts`

`subscribeToThread()` listens on a thread topic.

On `run-registered`:

- `activeThreadRunIds[key] = runId`;
- `seenRunIds.delete(runId)` so a same-run resume is not deduped away;
- it enqueues the local record or creates a remote proxy run.

The subscriber generator then reads the run's subscriber stream and yields parts to the Harness.

Terminal chunks in baseline are:

- `finish`
- `error`
- `abort`
- `tool-call-suspended`

After one of these, the subscriber generator releases the active read path and drains remaining stream data in the background to avoid upstream backpressure.

## Known architectural tension in the baseline

The baseline is intentionally narrow and has fragile edges:

1. `resumeStream()` is both a direct stream API and a subscription-registered API.
2. Harness generic tool resume calls `resumeStream()` but relies on subscriptions to consume its output.
3. `sendToolApproval()` is approval-specific and resolves active runs through `getActiveThreadRunId()`.
4. Runtime only treats approval suspensions as thread-blocking suspended runs (`approvalSuspendedRunIds`). Generic `tool-call-suspended` is not modeled as a first-class suspended run set.
5. Signals depend on `activeThreadRunIds` + `#isThreadBlockingRun()`; if a resumed run is not considered active at the instant of submission, the signal may fall into idle behavior.
6. The subscriber generator treats `tool-call-suspended` as terminal and drains the rest of that run's stream in the background.

These are the pressure points that made the later broad fixes risky.

## Baseline invariants to preserve before changing anything

- A Harness stream should have one authoritative consumer path.
- If the Harness has an open thread subscription, resumed output should reach that subscription live.
- Approval resumes should not require the Harness to consume the returned `MastraModelOutput`.
- Same-run resumed streams must be visible as a fresh stream boundary to existing subscribers.
- A suspended approval run must remain discoverable long enough for `sendToolApproval()` to find it.
- Direct `agent.stream()` callers must still be able to consume their returned output normally.
- A follow-up signal must not start an idle run when it was submitted against an actually active/resumed run.
