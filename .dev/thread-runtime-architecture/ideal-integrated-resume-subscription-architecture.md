# Ideal integrated resume + subscription architecture

This note describes the architecture we should aim for after separating the existing `resumeStream` behavior from the thread subscription/signal runtime. It deliberately does **not** follow the failed patch path. It uses that attempt only to identify hazards to avoid.

## Goal

Make suspended-tool resume, tool approval, thread subscriptions, live UI rendering, and steering signals work together with one clear ownership model:

- resumed output is delivered live to the active thread subscription;
- tool results are not dropped after tool-call finish boundaries;
- steering submitted during an active/resumed run is routed as active steering;
- direct `agent.stream()` / `agent.resumeStream()` callers can still consume their returned streams normally;
- abort does not duplicate stream items or pending steering entries;
- UI pending/active state is derived from authoritative runtime/session state, not optimistic guesses.

## Non-goals

- Do not redesign the whole agent loop.
- Do not make Harness-specific behavior leak into generic Agent APIs.
- Do not make all consumers use subscriptions.
- Do not patch only the TUI to hide runtime inconsistencies.
- Do not add timing-based test fixtures as the main proof.

## Core principle: separate execution from observation

The clean model should distinguish:

1. **Execution owner**: the code path that starts or resumes a run and owns the model output.
2. **Observation channels**: subscriptions, UI harness consumers, remote subscribers, traces, and persisted events that observe run parts.
3. **Control plane**: approvals, resume data, aborts, and steering signals that target a run/thread.

The failed approach blurred these by trying to make `resumeStream()` both:

- the direct output returned to a caller; and
- the authoritative subscription broadcaster for Harness output.

That creates stream-consumption races because many model outputs are single-reader `ReadableStream`s.

## Desired ownership model

### Direct API calls

When user code calls:

- `agent.stream()`
- `agent.resumeStream()`
- `agent.approveToolCall()`
- `agent.declineToolCall()`

it should receive an output it can consume directly. Registering the run for thread awareness must not steal or pre-consume that output.

If the runtime needs to publish subscription events for direct calls, it must either:

- tee/multicast safely without mutating getter-only output objects; or
- observe from an execution-layer fanout that is independent of the public `fullStream`; or
- only start subscription broadcast when the caller explicitly chooses subscription-owned execution.

### Harness / subscription-owned runs

Harness should have a first-class path for runs whose output is owned by the thread subscription.

For example, conceptually:

```ts
agent.sendStreamResume({ threadId, resourceId, runId, resumeData, toolCallId, streamOptions });
```

or an internal runtime-level primitive with equivalent semantics.

Properties:

- returns an acknowledgement, not a public model stream;
- registers/resumes the run under the thread runtime;
- guarantees subscription delivery owns the output consumption;
- resolves only when the resume is accepted/registered, not necessarily completed;
- optionally exposes a separate settle promise if Harness needs to wait for terminal UI state.

This prevents Harness from calling `resumeStream()` and then intentionally ignoring a direct stream that still exists.

## Stream identity naming

Use these terms internally:

- `runId`: the logical agentic run identity, stable across suspend/resume.
- `streamId`: one concrete stream registration/lifetime for a run. A resumed same-run stream gets a new `streamId`.
- `streamSeq`: optional monotonically increasing number per `runId`, useful for debug output and stale cleanup checks.

Avoid `epochId` in code/docs unless we later need distributed-systems terminology. `streamId` is more immediately obvious to readers because subscribers consume streams.

I would not use `runStreamId` or `runSeq`: those names are more verbose but not clearer. Inside `AgentThreadRunRecord`, `streamId` already has run context. In event payloads, `runId` and `streamId` appear together, which makes the relationship explicit.

## First-class run lifecycle state

The runtime should model run lifecycle explicitly instead of deriving too much from output status and one approval-specific set.

Suggested lifecycle states:

- `reserved`: run id has been allocated but model stream has not registered yet;
- `running`: stream has registered and is producing parts;
- `suspending`: a suspension chunk was emitted and terminal processing is in progress;
- `suspended`: run is parked awaiting resume data;
- `resuming`: resume request accepted and new stream registration is expected;
- `completed`;
- `failed`;
- `aborted`.

Runtime records should include:

- `runId`
- `threadId`
- `resourceId`
- `agentId`
- lifecycle state
- suspension metadata, when suspended:
  - `toolCallId`
  - `toolName`
  - suspension kind (`approval`, `generic-tool`, `plan`, etc. if useful)
- stream options needed for safe follow-up execution
- abort controller/prepared run info

### Why this matters

At baseline, only `approvalSuspendedRunIds` keeps a suspended run blocking/discoverable. Generic `tool-call-suspended` is not modeled equivalently. That makes `request_access`, `ask_user`, and approval paths diverge even though they share the same core suspend/resume mechanics.

The ideal architecture treats any suspended tool run as a real run lifecycle state, not an exception.

## Thread active state

A thread should be considered active when its current run is:

- `reserved`
- `running`
- `suspending`
- `suspended` and accepts follow-up/resume/control signals
- `resuming`

But different APIs need different predicates:

### `isThreadBlocking`

Used to prevent another independent agent/run from taking over the thread.

True for:

- `reserved`
- `running`
- `suspending`
- `resuming`
- maybe `suspended`, depending on whether the suspension should block unrelated idle starts

### `acceptsSteeringSignal`

Used when the user submits input while the UI considers the run active.

True for:

- `reserved`
- `running`
- `resuming`

Probably false for a fully parked `suspended` run unless the intended behavior is to queue steering to run immediately after resume.

### `isVisibleActive`

Used by UI to show pending/steer state.

True for:

- `reserved`
- `running`
- `suspending`
- `resuming`

Maybe a separate visible state for `suspended` so UI can show an approval/access prompt rather than ordinary running state.

The key is to stop using one overloaded `activeRunId()` as every semantic answer.

## Resume model

### Resume request

A resume request should target a concrete suspended run and tool call:

```ts
{
  threadId,
  resourceId,
  runId,
  toolCallId,
  resumeData,
  streamOptions,
}
```

The runtime should validate:

- the run exists or can be loaded from snapshot;
- the run is suspended/resumable;
- the tool call matches a parked suspension when provided;
- the target agent owns the run or is allowed to resume it.

### Resume acceptance

On acceptance:

1. transition run lifecycle to `resuming`;
2. keep the run visible/active to subscribers and UI;
3. register the upcoming resumed stream with a new `streamId` for the same run id;
4. publish an explicit resume event if subscribers need to reset run-local dedupe;
5. return `{ accepted: true, runId, toolCallId }`.

### Stream registrations

Same run id can have multiple concrete stream registrations:

- initial stream registration;
- resumed stream registration 1;
- resumed stream registration 2 for serialized suspensions, etc.

Each registration gets a new `streamId` and may increment `streamSeq` on the run record.

Subscriber dedupe should be based on `streamId`, or `(runId, streamSeq)`, not only `runId`.

This is cleaner than deleting `seenRunIds` opportunistically on `run-registered`.

### Resume completion

When a resumed stream completes:

- transition to `completed` if final;
- transition back to `suspended` if another tool suspension occurs;
- transition to `failed`/`aborted` on error/abort;
- clear active ownership only when the lifecycle truly leaves active/resumable state.

Stale completion handlers from older stream registrations must not clear newer stream state. Completion cleanup should check record identity, `streamId`, or `streamSeq` before mutating active maps.

## Subscription model

### Subscriber stream boundaries

Subscriptions should receive explicit boundaries:

- `run-started` / `start`
- stream parts
- `run-suspended`
- `run-resuming` or new stream-boundary `start`
- stream parts
- terminal `completed` / `failed` / `aborted`

A resumed same-run stream should not depend on a fresh `start` chunk being present. Runtime can synthesize a stream boundary for subscribers if the model stream starts with `tool-result`.

### Terminal chunks

The subscriber generator should not treat all `finish` chunks as final run termination.

We need distinguish:

- step/tool-call boundary: e.g. finish reason `tool-calls`; stream continues with tool results;
- suspension boundary: tool is parked; current stream registration is paused;
- final run terminal: complete/error/abort.

Rule of thumb:

- Do not release/drain the subscriber-visible reader until the runtime knows the run/stream registration is actually done for subscribers.
- If background draining is necessary for upstream backpressure, it must not hide parts that subscribers are supposed to see.

The failed fix taught us that a local patch like “don’t treat finish(tool-calls) as terminal” is directionally correct but insufficient if stream ownership and lifecycle are still muddled.

## Signal model

### Capture user intent synchronously

When UI/Harness receives user input, it should synchronously classify intent using current session/runtime state:

- active steering
- idle user message
- response to suspension prompt
- command/control input

If input is classified as active steering, the accepted async path should carry that decision and target run id through to runtime. It should not re-check active/idle after awaits and silently change behavior.

Conceptual shape:

```ts
const target = session.captureSignalTarget();
agent.sendSignal(signal, { target });
```

Where target may include:

- `mode: 'active' | 'idle'`
- `runId`
- `threadId`
- `resourceId`
- `streamId` if needed
- fallback policy if target is no longer valid

### Explicit fallback policy

If an active steering target is gone by the time runtime receives it, behavior should be explicit:

Options:

- reject as stale;
- persist as a user message but do not wake a model;
- queue for the next run in that thread;
- wake idle using full stream options.

It should never accidentally wake an idle run with incomplete model context and produce “No model selected.”

### Follow-up signal execution

Follow-up signals queued during a running/resuming run should have clear identity semantics.

Current baseline drains them after completion into `agent.stream(signal, { runId: randomUUID() })`.

Ideal architecture should decide deliberately:

- Are active steering follow-ups new turns with new run ids?
- Or are they continuations/new stream registrations of the existing run?
- How should UI display them?
- Which stream options/context are authoritative?

Whatever the answer, tests should assert it.

## Abort model

Abort should be a state transition, not just reader cancellation.

On abort:

1. transition active run/stream registration to `aborted`;
2. cancel underlying execution;
3. publish exactly one abort terminal event per visible run/stream registration;
4. clear pending/resuming state consistently;
5. decide what happens to queued steering/pending idle signals;
6. prevent stale background drains from emitting duplicate terminal UI items.

The failed attempt showed duplicate stream items after abort, which points to multiple consumers/handlers finalizing the same logical run.

## UI pending/steer state

UI should not rely on optimistic rendering for steering.

Desired behavior:

- User input submitted while visible-active should appear when runtime/Harness accepts it as an active signal.
- Pending indicator should appear while acceptance/routing is outstanding.
- If routing is rejected/stale, UI should show a clear non-steering fallback or error.
- If the signal is queued as active steering, UI should mark it as `steer` consistently.

The bottom pending indicator being absent during the manual test is a separate proof requirement: the UI/harness event stream should expose enough state to render pending signal acceptance.

## API shape proposal

Public surface should be minimal and experimental at first. The only new Agent-facing API proposed here is `sendStreamResume()`.

### Runtime-level primitive

```ts
resumeThreadRun(agent, {
  threadId,
  resourceId,
  runId,
  toolCallId,
  resumeData,
  streamOptions,
  ownership: 'subscription',
}): Promise<{ accepted: true; runId: string; toolCallId?: string }>
```

Semantics:

- validates suspended run;
- transitions lifecycle to `resuming`;
- starts/resumes execution;
- registers a new stream identity;
- does not expose a direct output stream when `ownership: 'subscription'`.

`streamId` should remain internal-only at first; the public acknowledgement does not need it unless a caller has a concrete use case.

### Agent helper

```ts
agent.sendStreamResume({ threadId, resourceId, runId, toolCallId, resumeData, streamOptions });
```

This covers any resumable suspended stream/run, including generic suspended tools and approval, without implying that only tools can suspend.

### Approval helper

`sendToolApproval()` can become a thin wrapper over generic `sendStreamResume()`:

```ts
sendToolApproval({ approved: true/false, ... })
  -> sendStreamResume({ resumeData: { approved }, ... })
```

This unifies approval and generic suspended behavior.

## Migration strategy

1. Keep current reset baseline.
2. Add lifecycle/stream-identity data structures behind existing runtime APIs without changing Harness behavior.
3. Add low-level tests for lifecycle and subscription semantics.
4. Add generic subscription-owned `sendStreamResume()` primitive.
5. Move Harness generic `handleToolResume()` to the new primitive.
6. Refactor `sendToolApproval()` to use the same primitive.
7. Only then address steering during resumed streams.
8. Only then update TUI behavior if core events/state are sufficient.

## Staged proof order

Each stage should merge only if its own narrow proof passes. Do not wait for the final TUI/E2E scenario to discover runtime regressions.

1. **Lifecycle-only stage**
   - Add explicit run lifecycle and stream identity state.
   - No Harness behavior changes.
   - Prove active/idle/suspended/resuming predicates with runtime unit tests.

2. **Subscription delivery stage**
   - Fix subscriber terminal-boundary semantics.
   - Prove tool-result delivery, same-run stream registrations, remote subscriber behavior, and direct stream consumption.

3. **Subscription-owned resume stage**
   - Add generic `sendStreamResume()` primitive returning acknowledgement metadata, not a public stream.
   - Prove generic suspended tools and approval tools use the same path.

4. **Harness integration stage**
   - Move `handleToolResume()` and approval handlers onto the primitive.
   - Prove request_access/ask_user/tool approval behavior without TUI timing fixtures.

5. **Signal steering stage**
   - Add synchronous target capture and explicit stale-target fallback.
   - Prove active steering during running/resuming and no accidental idle wake.

6. **UI/E2E stage**
   - Update TUI rendering only after core/Harness state is authoritative.
   - Prove pending indicator, steer badge, abort cleanup, and no duplicate output.

## What not to repeat from the failed approach

- Do not make broad runtime, Harness, TUI, E2E, and timing-fixture changes in one step.
- Do not rely primarily on one MastraCode E2E scenario as proof.
- Do not fix UI active checks while runtime active state is still inconsistent.
- Do not let broadcast consume direct model streams unless there is a proven tee/fanout strategy.
- Do not add one-off suspended-run sets that only partially model lifecycle.
- Do not use sleeps/long fixtures to create steering windows as the main correctness proof.
- Do not let stale completion handlers mutate active state for a newer same-run stream registration.

## Required tests

Tests should prove the architecture at multiple levels. E2E should be the final confirmation, not the first proof.

### 1. Runtime lifecycle unit tests

File area: `packages/core/src/agent/__tests__/agent-signals.test.ts` or a new focused runtime test file.

Needed cases:

- Register run -> lifecycle `running`, active thread true.
- Tool suspension -> lifecycle `suspended`, suspension metadata recorded.
- Resume accepted -> lifecycle `resuming`, active/visible state true.
- Resumed stream registered with same run id -> new `streamId` visible internally to subscribers.
- Old stream completion cannot clear newer stream active state.
- Final completion clears active state once and only once.
- Abort during running/resuming emits one terminal abort and clears state once.

### 2. Subscriber delivery tests

Prove exact chunk delivery without Harness/TUI.

Cases:

- Subscriber sees tool-call finish followed by tool-result; result is not dropped.
- Subscriber stays open across non-final finish boundaries.
- Subscriber receives generic `tool-call-suspended` and does not lose the next resumed suspension in serialized flows.
- Same-run resume without `start` chunk still produces a new subscriber stream boundary.
- Remote subscriber joining after registration still receives subsequent parts or a coherent remote proxy run.
- Direct caller consuming `agent.stream()` still receives text when no subscriber exists.
- Direct caller and subscriber do not race/lock the same `ReadableStream` in whichever modes are supported.

### 3. Resume primitive tests

Tests for the new generic subscription-owned `sendStreamResume()` primitive.

Cases:

- `sendStreamResume()` resumes `ask_user`/generic suspension and returns accepted without direct stream.
- `sendToolApproval()` delegates to the same path for approve/decline.
- Missing thread/resource/run/toolCallId errors are explicit.
- Resume against a non-suspended run is rejected.
- Resume preserves shared stream options (`maxSteps`, approval policy, memory, requestContext, toolsets).
- Serialized suspensions: answer first prompt -> second prompt is emitted before the API resolves if that is the chosen contract, or expose a settle promise if not.

### 4. Signal routing tests

Prove steering classification and runtime routing independently from TUI.

Cases:

- Signal submitted while run is `running` queues as active follow-up.
- Signal submitted while run is `resuming` queues as active follow-up.
- Signal submitted while subscriber active but `session.run` temporarily stale still targets the active run if UI captured active target.
- Signal captured as active but delivered after completion follows explicit fallback policy; it must not silently wake idle without full stream options.
- Pending active signal has correct attributes so UI can render `steer`.
- Active signal acceptance does not build idle toolsets/options unless fallback requires idle wake.

### 5. Harness integration tests

Cases:

- `request_access` resume delivers live tool result in the same subscription, no duplicate request_access call.
- `ask_user` serialized flow surfaces prompts one at a time across resumes.
- `handleToolApprove()` and `handleToolDecline()` produce one resumed output path and no direct double-consumption.
- `respondToToolSuspension()` either waits for the resumed stream to settle or documents that it only waits for acceptance; tests should match the chosen contract.
- Abort after queued steering does not duplicate stream items or duplicate pending steering display events.

### 6. TUI/unit UI tests

Cases:

- While visible-active, input is sent as steering, not normal chat.
- Steering is not optimistically rendered before acceptance.
- Pending indicator appears while signal acceptance is pending.
- Accepted active steering appears once with `steer` badge.
- Stale/rejected active steering shows the chosen fallback once.
- Abort clears pending indicator and does not duplicate prior output.

### 7. MastraCode E2E smoke tests

Keep these narrow and deterministic.

Cases:

- Request access -> grant -> live tool result appears -> no repeated request access.
- During a long-running command/tool sequence, send steering -> appears as steer -> agent receives it.
- Abort during/after queued steering -> no duplicate stream items, no duplicate steering item.

Avoid relying on long artificial sleeps as the only proof. Sleeps are useful for manual smoke but should not be the core regression test.

## Success criteria

We should consider the architecture working only when all of these are true:

- One logical run/stream registration has one authoritative stream owner.
- Subscriptions receive all parts they are supposed to display.
- Direct stream consumers still work.
- Suspended runs are first-class runtime state, not approval-only exceptions.
- Resume acceptance keeps the target run visible/active until the resumed stream is registered or explicitly fails.
- Steering classification is stable across async awaits.
- No dropped tool results in live UI.
- No duplicate output after abort.
- Tests prove runtime behavior before E2E timing scenarios are used.
