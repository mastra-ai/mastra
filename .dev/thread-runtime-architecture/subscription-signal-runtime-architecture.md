# Subscription and signal runtime architecture

This note describes the thread subscription and signal-routing architecture in the reset baseline (`bff80049cc0`). It is separate from the existing `resumeStream` architecture note so we can reason about subscriptions/signals without treating resume behavior as already solved.

## Scope

This covers:

- `AgentThreadStreamRuntime`
- `subscribeToThread()`
- `sendSignal()` / `sendMessage()` / `queueMessage()`
- pending signal queues
- thread active/idle state
- Harness subscription consumption
- Harness steering/message input behavior

It intentionally avoids proposing changes.

## Runtime state model

Location: `packages/core/src/agent/thread-stream-runtime.ts`

`AgentThreadRuntimeState` is scoped by PubSub instance and contains:

- `threadRunsById`: local run records keyed by run id.
- `threadKeysByRunId`: maps run id to encoded `(resourceId, threadId)` key.
- `activeThreadRunIds`: maps encoded thread key to the run currently owning that thread.
- `approvalSuspendedRunIds`: approval-suspended run ids that still block the thread.
- `pendingSignalsByThread`: follow-up signals for an active same-agent run after it has started model work.
- `preRunSignalsByThread`: signals sent after a run id is reserved but before the first model request.
- `pendingIdleSignalsByThread`: idle-start requests waiting behind a blocking active run.
- `pendingContinuationsByThread`: queued message continuations waiting behind a blocking active run.
- `watchedThreadRunIds`: run ids with an attached completion watcher.
- `preparedRunsById`: abort-controller wrappers for prepared runs.
- `abortedRunIds`: run ids aborted before preparation or while prepared.

## Thread identity

Runtime uses a string key:

```ts
resourceId + '\u0000' + threadId
```

Every active-state decision goes through this key. Any caller that omits either thread or resource can accidentally lose precise routing and fall back to run-id-only behavior or idle behavior.

## Active vs idle thread state

`getThreadState()` and subscription `activeRunId()` use the same core idea:

1. Look up `activeThreadRunIds[key]`.
2. If missing, thread is idle.
3. If there is a local record, check `#isThreadBlockingRun()`.
4. If the record is not blocking, clear stale active state and return idle/null.
5. Otherwise report active.

At baseline, `#isThreadBlockingRun()` is:

```ts
record.output.status === 'running' || approvalSuspendedRunIds.has(record.runId)
```

That means:

- running streams block the thread;
- approval-suspended streams block the thread;
- generic tool suspensions do not have their own blocking set;
- completed/failed/aborted records should not block.

## Run registration and broadcast

### `prepareRunOptions()`

When a run has thread memory and a run id, runtime creates a per-run abort controller and stores it in `preparedRunsById`.

This lets `abortRun(runId)` abort the runtime-owned signal passed into agent execution.

### `registerRun()`

Every streamed agent run that has thread memory is registered:

1. Resolve thread/resource from execution options.
2. Wrap the model output with `#withBroadcastStream()`.
3. Store the run record in `threadRunsById`.
4. Store `threadKeysByRunId[runId] = key`.
5. Store `activeThreadRunIds[key] = runId`.
6. Publish `run-registered`.
7. Start broadcast once registration publish settles.
8. Watch for completion.

`registerRun()` returning the publish promise matters because consumers may need registration to be visible before they treat the run as active.

### `#withBroadcastStream()`

This is the current multicast mechanism:

- It reads the original `output.fullStream`.
- It buffers parts in an in-memory `parts` array.
- It publishes each part as `stream-part` to PubSub.
- It creates per-subscriber streams that replay buffered parts and wait for new ones.

It starts reading lazily when a subscriber stream pulls, but `registerRun()` also calls `startBroadcast()` after `run-registered` publishes. In baseline, this means runtime can consume the original `fullStream` even when the direct caller also expects to consume it.

Risk: direct stream consumers and broadcast consumers can compete for the same `ReadableStream` unless the output is safe to multicast or broadcast start is carefully controlled.

## Subscription model

### `subscribeToThread()`

`subscribeToThread(agent, { resourceId, threadId })` returns an `AgentThreadSubscription`:

- `activeRunId()` returns the runtime's current active run id for that thread, or null.
- `abort()` aborts the active thread run.
- `unsubscribe()` detaches the PubSub listener and cancels the current reader.
- `stream` is an async generator of stream parts from matching runs.

### Local and remote runs

The subscriber supports two cases:

1. Local run record exists in `threadRunsById`.
   - The subscriber uses `record.createSubscriberStream()`.
2. Only PubSub events exist from another runtime/process.
   - The subscriber creates a remote proxy run whose stream is fed by `stream-part` events.

### `run-registered` event

On `run-registered`:

- mark the run active for the thread;
- remove it from `seenRunIds` so same-run resume can be consumed again;
- enqueue the local record or remote proxy;
- wake the generator.

This is the key same-run resume hook in the baseline: a reused run id is treated as a fresh stream boundary.

### `stream-part` event

On remote `stream-part`:

- ignore events from this runtime's own source id;
- find or create a remote proxy run;
- append the part;
- wake readers.

### Terminal behavior

The subscription generator treats the following chunks as terminal for the current run pass:

- `finish`
- `error`
- `abort`
- `tool-call-suspended`

After yielding a terminal chunk, it starts a background drain of the underlying reader and moves on to pending runs. This is intended to prevent upstream backpressure, but it is also a sensitive area: if useful parts arrive after a terminal-looking chunk, subscribers will not see them.

## Completion watcher and queues

`#watchThreadRunCompletion()` waits for `_waitUntilFinished()`.

### Approval suspension

If output status is `suspended` and the run id is approval-suspended:

- publish `run-suspended`;
- keep runtime state;
- do not drain pending signals.

### Normal completion

Otherwise:

1. Clear prepared/abort state.
2. Remove approval-suspended marker.
3. Delete run record and run key.
4. Clear `activeThreadRunIds[key]` if this run still owns it.
5. Publish `run-completed`.
6. Drain queues in this order:
   - pending follow-up signals;
   - pending continuations;
   - pending idle signals.

## Signal routing

### Signal creation

Harness and runtime normalize message input into `CreatedAgentSignal` objects. Signals may represent:

- user text/messages;
- state updates;
- reactive/system reminder signals.

### Delivery knobs

`sendSignal()` has two behavior groups:

- `ifActive`: what to do if an active target exists.
- `ifIdle`: what to do if no active target exists.

Common behaviors:

- active `deliver`: queue into active run;
- active `persist`: save/broadcast without waking a model turn;
- idle `wake`: start a new run;
- idle `persist`: save/broadcast without waking.

### Active target resolution

`sendSignal()` tries to resolve:

- explicit `runId` from caller;
- thread key from `resourceId/threadId`;
- `activeThreadRunIds[key]`;
- local run record from `threadRunsById`.

If the active record exists but no longer blocks the thread, runtime clears it.

A signal is an active target when:

```ts
runId && (
  activeRecord?.output.status === 'running' ||
  (key && activeThreadRunIds.get(key) === runId)
)
```

This is broader than `#isThreadBlockingRun()` in one way: if the key points at the run id, it may count as active even before the record exists.

### Same-agent active run

If there is a blocking active record and it belongs to the same agent:

- push the signal into `pendingSignalsByThread[key]`;
- publish `signal-enqueued`;
- watch run completion;
- return accepted.

These are follow-up signals for an already-started run. They are not folded into the current model request; they become a later model turn.

### Reserved local run before first model request

If the run id is reserved in `threadKeysByRunId` but no local record exists yet:

- push signal into `preRunSignalsByThread[key]`;
- publish `signal-enqueued` with `preRun: true`;
- return accepted.

These are folded into the first model request by the loop when it drains `scope: 'pre-run'`.

### Idle behavior

If no active target accepts the signal:

- require resource/thread;
- create a new random run id;
- if idle behavior is `persist`, save/broadcast and return;
- if idle behavior is not `wake`, accept without running;
- if another run owns the thread key, enqueue into `pendingIdleSignalsByThread`;
- otherwise reserve `activeThreadRunIds[key] = runId`, store `threadKeysByRunId`, and call `agent.stream(signal, { ...streamOptions, runId, memory })`.

This is where a misclassified active steering signal can become a fresh idle run.

## Queue draining

### `drainPendingSignals(runId, scope)`

Used by execution loops to fetch queued signals.

- `scope: 'pre-run'` drains pre-run signals.
- default `scope: 'pending'` drains follow-up signals.

It resolves the thread key from the run record or `threadKeysByRunId`.

### `#drainPendingSignals()` after run completion

After a run completes, runtime drains at most one pending follow-up signal:

1. Move leftover pre-run signals into pending follow-up queue.
2. Shift one pending signal.
3. Start `previousRun.agent.stream(signal, { ...previousRun.streamOptions, runId: randomUUID(), memory })`.
4. If more queued signals remain, watch the new run.

Important baseline behavior: follow-up signals drained after completion become a **new run id**, not the original run id.

### Continuations

`continueWithMessages()` queues or starts message continuations.

When started, continuations use their own pending run id and call `agent.stream(messages, { ...streamOptions, runId })`.

### Pending idle signals

Idle signals that could not start because another run owned the thread are queued and later started once the active run clears.

## Harness subscription consumption

Location: `packages/core/src/harness/harness.ts`

### Opening subscription

`ensureAgentThreadSubscription()`:

1. Build a `SessionStream` key from agent/resource/thread.
2. If the existing subscription matches, reuse it.
3. Otherwise clean up existing subscription and run state.
4. Call `agent.subscribeToThread()`.
5. Attach it to `SessionStream`.
6. Start `processSubscribedThreadStream(subscription)` asynchronously.

### Processing subscription stream

`processSubscribedThreadStream()`:

- reads `subscription.stream`;
- ignores chunks from stale subscriptions;
- creates a `HarnessStreamState` at first chunk of a run;
- sets `session.run.runId` from `subscription.activeRunId()` or chunk run id;
- emits `agent_start`;
- sends chunks through `processStreamChunk()`;
- finishes the run on `finish`, `error`, `abort`, `tool-call-suspended`, or a stream result;
- emits terminal events through `finishSubscribedStreamRun()`;
- uses `lastFinishedRunId` to skip trailing chunks from a finished run;
- clears `lastFinishedRunId` for suspended runs so same-run resume chunks can be accepted.

Key local dedupe behavior:

- trailing chunks with the same finished run id are skipped;
- a new `start` chunk clears the guard;
- suspended runs clear the guard immediately because resumed streams may reuse the run id and may start at `tool-result`, not `start`.

## Harness signal/message behavior

### `sendSignal()`

Harness `sendSignal()`:

1. Creates a signal immediately.
2. Defers acceptance work into a promise.
3. Creates a thread if needed.
4. Ensures subscription exists.
5. If both `session.run.getRunId()` and `session.stream.activeRunId()` are present, sends an active-path signal without building idle stream options.
6. Otherwise builds full idle stream options and calls `agent.sendSignal()` with `ifIdle.streamOptions`.

Important timing issue in baseline: active state is checked inside the async acceptance promise, after `ensureAgentThreadSubscription()` and possible other awaits. The UI may have submitted while active, but the runtime can become idle before the check executes.

### `sendMessage()`

Harness `sendMessage()` delegates to `sendSignal()`.

If the session was idle before sending, it waits for the thread stream to become idle and may emit `agent_end` if no suspension remains.

### Steering UI implication

For a TUI or app deciding whether user input is a steering signal vs a new user message, the important state source is:

- `SessionStream.isActive()` / `activeRunId()`;
- sometimes `SessionRun.isRunning()` in UI code outside core.

Core Harness active-path signal routing additionally requires both:

```ts
session.run.getRunId() && session.stream.activeRunId()
```

If either side is stale/null, Harness builds idle options and the signal can wake a new run.

## Known fragile boundaries

1. `#withBroadcastStream()` can consume `output.fullStream`, which can conflict with direct consumers.
2. `registerRun()` starts broadcast automatically after registration.
3. Subscription terminal handling treats `finish` and `tool-call-suspended` as terminal and background-drains remaining parts.
4. `lastFinishedRunId` dedupe is necessary but sensitive for same-run resumes.
5. Generic suspended runs are not tracked separately from approval suspensions.
6. Signal active-state checks happen after async work in Harness.
7. Follow-up signals drained after completion become new random run ids and rely on previous run stream options.
8. UI-visible active state comes from subscription state, while Harness run state comes from stream processing; these can diverge.
9. Abort and unsubscribe cancel readers, then synthetic abort handling may emit terminal chunks; event ordering matters.

## Questions to answer before another fix

- Should `resumeStream()` remain both a direct-consumption API and a subscription-broadcast API, or should Harness use a separate non-consuming resume primitive?
- Should all `tool-call-suspended` runs be first-class suspended runs in runtime state, not just approval suspensions?
- Should active-path signals be based on state captured synchronously at UI submit time?
- Should subscription broadcast ever consume a direct caller's `ReadableStream` before a subscriber attaches?
- Should `finish(tool-calls)` be considered terminal for subscribers, or only final finish/error/abort/suspended?
- Should follow-up signals submitted during a resumed same-run stream drain into the same run identity or a new run?
- Which layer owns the user-visible pending/steer state: UI, Harness, Session, or runtime subscription?
