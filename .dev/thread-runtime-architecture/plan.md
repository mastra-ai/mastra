# Phased plan: subscription-owned resume + stream identity

This plan starts from reset baseline `bff80049cc0` and intentionally moves from smallest runtime surface area to largest UI/E2E surface area. Each phase should be independently reviewable and should not depend on timing-heavy MastraCode E2E as the first proof.

## Related docs

This file is intended to be readable on its own. The deeper architecture notes are linked here for reviewers who want implementation context:

- [`resume-stream-existing-architecture.md`](./resume-stream-existing-architecture.md): documents the reset-baseline `resumeStream()` / tool approval behavior before introducing a broader resume primitive.
- [`subscription-signal-runtime-architecture.md`](./subscription-signal-runtime-architecture.md): documents the reset-baseline thread subscription, signal routing, pending queues, and active/idle state model.
- [`ideal-integrated-resume-subscription-architecture.md`](./ideal-integrated-resume-subscription-architecture.md): documents the target architecture this plan implements in phases.

## Problem summary

The reset baseline has the narrow `sendToolApproval()` fixes, but generic suspended-tool resume, subscriptions, and steering still do not share one coherent ownership model.

The live failures we need to prevent are:

- Tool results can be dropped from the live subscription, so the agent may repeat a tool call such as `request_access` because it never observes the result.
- Steering submitted during active/resumed streams can be lost or reclassified as an idle message after async awaits.
- Aborting while stream items are racing can duplicate output.
- The TUI can miss authoritative pending/steer state and either show nothing or optimistically render the wrong thing.
- Attempts to make one E2E pass can hide the real runtime issue if the core stream/subscription model is still ambiguous.

## Concepts used by this plan

### Run

A run is the logical execution of an agent turn on a thread. It is identified by `runId`. A suspended run can later resume and still be the same logical run.

### Stream registration

A stream registration is one concrete stream lifetime for a run. A same-run resume creates a new concrete stream lifetime while preserving the logical `runId`.

This plan names that internal identity:

- `streamId`: unique id for one concrete stream registration/lifetime.
- `streamSeq`: monotonically increasing number per `runId`, useful for ordering and stale cleanup checks.

`streamId` and `streamSeq` are internal runtime concepts, not public API.

### Direct-consumer execution

Direct APIs like `agent.stream()` and existing `agent.resumeStream()` return a stream to the caller. The caller owns consumption of that returned stream. Thread subscription machinery may observe/register the run, but it must not steal, lock, or pre-consume the returned stream.

### Subscription-owned execution

Harness/TUI flows often want a background subscription to be the only consumer of live output. Subscription-owned execution means the runtime starts/resumes the run and delivers output through `subscribeToThread()` instead of returning a public stream for the caller to consume.

### Suspension

A suspension is a run state where execution is waiting for external input before it can continue. Examples include approval, `ask_user`, and `request_access`. The plan treats suspensions as generic first-class runtime state, not approval-only special cases.

### Resume APIs

- `resumeStream()` remains the direct-consumer API: it resumes and returns a stream to the caller.
- `sendStreamResume()` is the proposed experimental subscription-owned API: it resumes a suspended run, returns acknowledgement only, and expects subscribers to receive live output.
- `sendToolApproval()` should become a wrapper over the same subscription-owned resume primitive so approval and generic tool resume do not diverge.

### Signal / steering

A signal is user input sent while a thread may already be running, suspended, or resuming. Steering is the active-run case: the input should target the existing run rather than start a new idle model turn.

The important rule is that signal intent must be captured synchronously at submit time, then carried through async work. It must not be reclassified after awaits just because a stream completed or state changed.

### Thread blocking

A suspended/resuming run should block unrelated idle messages by default. Otherwise a new idle model turn can interleave into a half-complete suspended run. Resume/control input remains allowed. The exact external behavior for unrelated idle input while blocked is decided in Phase 7, but the runtime must not silently start a new model run.

## Guiding constraints

- Keep `resumeStream()` as the direct-consumer API: it returns a stream and callers can consume it normally.
- Add only one new Agent-facing API: experimental `sendStreamResume()`.
- Keep `streamId` / `streamSeq` internal unless a concrete external need appears.
- Treat suspended runs as first-class runtime state, not approval-only exceptions.
- Do not let thread subscriptions steal direct `agent.stream()` / `agent.resumeStream()` output.
- Do not use TUI active-state hacks to hide runtime state bugs.
- Do not rely on long sleeps or one E2E fixture as the core proof.
- Each phase should land as one or more focused commits before starting the next phase. Do not carry uncommitted phase work across phase boundaries.

## Phase 0 — Baseline lock and regression fixtures

### Goal

Freeze the reset baseline and add focused failing/protective tests that describe the known bugs without changing behavior yet.

### Implementation scope

- No production behavior changes unless required to make tests compile.
- Add or isolate focused tests for current failure modes. If a test is intentionally red, pair it with the fixing phase rather than merging a standalone failing-test commit.
- Confirm the branch remains reset to the send-tool-approval baseline.

### Required proof

Tests should prove or capture:

- Generic suspended tool resume currently depends on Harness calling `resumeStream()` and ignoring the returned stream.
- Subscription drops or risks dropping parts after terminal-looking boundaries, especially `finish(tool-calls)` and `tool-call-suspended`.
- Direct `agent.stream()` / `resumeStream()` consumption must continue to produce parts when no subscriber consumes the run.
- Same-run resume currently relies on `seenRunIds.delete(runId)` style behavior.

### Verification commands

Run the narrowest tests that cover touched areas, for example:

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
```

If no tests are changed in this phase, record the exact current failing/passing baseline manually in the PR notes. Do not leave the branch with committed failing tests outside an active fix phase.

## Phase 1 — Stream ownership guardrails

### Goal

Ensure thread subscription broadcast cannot steal or pre-consume streams returned by direct APIs.

### Implementation scope

- Keep public API behavior unchanged.
- Audit `registerRun()` / broadcast startup behavior for direct `agent.stream()` and `resumeStream()` calls.
- Establish an explicit ownership mode internally:
  - direct-consumer execution: caller owns returned stream;
  - subscription-owned execution: runtime subscription owns stream consumption.
- If direct calls still register for thread awareness, registration must not lock or consume `output.fullStream` before the direct caller can read it.
- Avoid mutating getter-only model output objects.

### Required proof

Tests must prove:

- Direct `agent.stream()` returns text parts when no subscriber is attached.
- Direct `resumeStream()` returns resumed parts when no subscriber is attached.
- Attaching a subscriber does not break direct-consumer behavior unless the API explicitly opts into subscription ownership.
- Subscription-owned paths still deliver parts through subscribers.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
```

## Phase 2 — Internal stream identity

### Goal

Introduce internal stream identity so the runtime can distinguish one logical run from one concrete stream registration.

### Implementation scope

- Add internal stream identity fields to thread run records:
  - `runId`: logical run identity.
  - `streamId`: unique id for one concrete stream registration/lifetime.
  - `streamSeq`: monotonically increasing number per `runId`.
- Add stream identity to runtime events internally where needed.
- Replace subscriber dedupe by `runId` with dedupe by `streamId` or `(runId, streamSeq)`.
- Keep public APIs and Harness behavior unchanged.

### Required proof

Tests must prove:

- Initial run registration gets a stream identity.
- Same-run resume gets a new stream identity while preserving `runId`.
- Subscriber consumes both initial and resumed stream registrations for the same `runId`.
- Stale completion for an older stream registration cannot clear active state for a newer same-run registration.
- Remote subscriber/proxy behavior remains coherent when stream identity is present.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
```

Do not move on until direct stream consumption and remote subscription tests still pass.

## Phase 3 — First-class suspended run lifecycle

### Goal

Model generic suspended runs as first-class runtime state instead of only tracking `approvalSuspendedRunIds`.

### Implementation scope

- Add explicit lifecycle state sufficient for current needs:
  - `running`
  - `suspending`
  - `suspended`
  - `resuming`
  - terminal states as needed by existing cleanup.
- Track suspension metadata:
  - `runId`
  - `toolCallId`
  - `toolName`
  - suspension kind, if useful.
- Generalize approval-specific suspended-run behavior to generic suspended tools.
- Keep `sendToolApproval()` behavior unchanged from callers' perspective.

### Thread blocking policy

A suspended run should probably block unrelated idle messages by default.

Rationale: while a tool is waiting for resume data, allowing an unrelated idle wake on the same thread risks interleaving a new model turn into a half-complete run.

Policy to implement or explicitly prove:

- Resume/control input for the suspended run is accepted.
- Same-agent explicit active/control signals can target the suspended/resuming run if allowed by policy.
- Unrelated idle wake while blocked must not silently start a new model run.
- In this phase, prove the runtime does not wake idle while blocked. Do not expand public signal result shapes yet.
- Defer the exact external behavior (`accepted: false`, explicit error, or persist-only fallback) to the signal-routing phase. Do not silently wake idle with partial stream options.

### Required proof

Tests must prove:

- `request_access` / `ask_user` / approval suspensions all leave a discoverable suspended run record.
- Suspended generic tools block unrelated idle wake on the same thread.
- Resume/control paths can still find the suspended run.
- Completion cleanup does not delete suspended state until resume/abort/final completion.
- Existing approval behavior still passes.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-tool-suspension.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-ask-user.test.ts --bail 1 --reporter=dot
```

## Phase 4 — Subscriber boundary semantics

### Goal

Make subscription delivery correct across non-final boundaries before changing Harness resume behavior.

### Implementation scope

- Distinguish final run termination from step/tool/suspension boundaries.
- Do not treat every `finish` chunk as final for subscribers.
- Do not background-drain subscriber-visible parts that the subscription is supposed to deliver.
- Preserve upstream backpressure safety without hiding tool results or resumed suspension chunks.

### Required proof

Tests must prove:

- Subscriber sees `finish(tool-calls)` followed by `tool-result` live.
- Subscriber remains open across non-final finish boundaries.
- Subscriber sees `tool-call-suspended` and can later see the resumed stream registration for the same `runId`.
- Serialized suspensions work: answer first prompt -> second prompt is delivered.
- Direct `agent.stream()` and direct `resumeStream()` still work when no subscription owns the stream.
- Abort still emits one terminal item and does not duplicate output.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-ask-user.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/om-failure-abort.test.ts --bail 1 --reporter=dot
```

## Phase 5 — Add experimental `sendStreamResume()`

### Goal

Add the subscription-owned resume API without moving Harness to it yet.

### Public API shape

Experimental Agent-facing API:

```ts
agent.sendStreamResume({
  threadId,
  resourceId,
  runId,
  toolCallId,
  resumeData,
  streamOptions,
}): Promise<{
  accepted: true;
  runId: string;
  toolCallId?: string;
}>
```

Semantics:

- Targets a concrete suspended run.
- Validates that the run is resumable.
- Starts the resumed execution as subscription-owned.
- Registers a new internal `streamId` for the same `runId`.
- Returns acknowledgement only; it does not return a public model stream.
- Keeps `streamId` internal.

### Implementation scope

- Add runtime primitive for subscription-owned resume.
- Add Agent helper `sendStreamResume()`.
- Preserve existing `resumeStream()` semantics.
- Do not yet alter TUI steering behavior.

### Required proof

Tests must prove:

- `sendStreamResume()` accepts a valid suspended generic tool run.
- It rejects or errors clearly for missing thread/resource/run/tool call where required.
- It rejects non-suspended/non-resumable targets.
- It does not return or expose a direct stream.
- Subscription receives resumed output live.
- Direct `resumeStream()` behavior remains unchanged.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/resume-span-tracing.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-tool-suspension.test.ts --bail 1 --reporter=dot
```

## Phase 6 — Move Harness resume/approval paths onto `sendStreamResume()`

### Goal

Remove the Harness smell where generic suspended-tool resume calls `resumeStream()` and ignores the returned stream.

### Implementation scope

- Update `handleToolResume()` to call `agent.sendStreamResume()`.
- Refactor `sendToolApproval()` to delegate to `sendStreamResume()` internally, or update Harness approval paths to use the same primitive through the existing approval API.
- Preserve caller behavior for approval buttons.
- Define whether `respondToToolSuspension()` resolves on acceptance or on resumed stream settle. Prefer an explicit contract and tests over implicit timing.

### Required proof

Tests must prove:

- `request_access` resume delivers live tool result in the active subscription.
- The agent does not repeat `request_access` because the tool result was dropped.
- `ask_user` serialized flow surfaces prompts one at a time across resumes.
- Approval approve/decline resumes through one path and does not double-consume.
- `respondToToolSuspension()` behavior matches the chosen acceptance/settle contract.
- No direct stream returned by `resumeStream()` is ignored in Harness generic resume paths.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-tool-suspension.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-ask-user.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/signal-messages.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/display-state.test.ts --bail 1 --reporter=dot
```

## Phase 7 — Signal target capture and blocked idle behavior

### Goal

Make steering/message routing stable across async awaits and suspended/resuming states.

### Implementation scope

- Capture Harness/UI signal intent synchronously at submit time:
  - active steering
  - idle message
  - resume/control response
  - blocked idle attempt
- Carry the captured target through async work instead of reclassifying after awaits.
- Define explicit fallback behavior when an active target disappears before runtime receives the signal.
- Implement blocked-thread behavior for unrelated idle messages while suspended/resuming.

### Required proof

Tests must prove:

- Input submitted while run is `running` is accepted as active steering.
- Input submitted while run is `resuming` is accepted as active steering if policy allows.
- Input submitted while a suspension prompt is visible does not accidentally wake idle.
- Unrelated idle message while suspended is rejected/blocked/persisted according to explicit policy; it must not start a new model run silently.
- Active steering captured before an async await does not become idle because the stream completed during the await.
- Stale active target fallback is explicit and tested.
- Active signal acceptance does not build idle toolsets/options unless fallback policy requires idle wake.

### Verification commands

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/harness/__tests__/signal-messages.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/display-state.test.ts --bail 1 --reporter=dot
```

## Phase 8 — TUI/display state integration

### Goal

Render pending/steer/abort states from authoritative Harness/runtime events, not optimistic UI guesses.

### Implementation scope

- Update display state only after runtime/Harness acceptance.
- Show bottom pending indicator while signal acceptance/routing is outstanding.
- Render accepted active steering once with `steer` badge.
- Render blocked/rejected stale input explicitly according to policy.
- Ensure abort clears pending indicators and does not duplicate prior output.

### Required proof

Tests must prove:

- Steering is not optimistically rendered before acceptance.
- Pending indicator appears while signal acceptance is pending.
- Accepted steering appears once with `steer` badge.
- Blocked unrelated idle message while suspended does not appear as normal assistant/user chat unless policy says persist-only.
- Abort after queued steering does not duplicate output.

### Verification commands

Use focused MastraCode tests first:

```bash
pnpm --filter mastracode test -- --run src/path/to/relevant.test.ts --bail 1 --reporter=dot
```

Then run the narrow E2E only after unit proof:

```bash
pnpm --filter mastracode test:e2e -- --grep tool-suspension-same-run-resume
```

Adjust exact commands to the package scripts available in the current checkout.

## Phase 9 — End-to-end smoke and full core confidence

### Goal

Use E2E as final confirmation, not primary proof.

### Required proof

Manual or automated smoke must prove:

- Live `request_access` result appears without reload.
- Agent does not repeat the same tool because result was dropped.
- Steering during active/resumed stream is visible and marked correctly.
- Unrelated idle message while suspended follows blocked policy.
- Abort does not duplicate output.
- Pending indicator appears at the bottom while relevant operations are pending.

### Verification commands

Before pushing final implementation:

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core
```

If the change touches MastraCode/TUI, also run the relevant focused MastraCode unit and E2E checks.

## Phase exit checklist

Before moving from one phase to the next:

- The phase has a narrow diff.
- The phase is committed in one or more focused commits before the next phase begins.
- Commit messages explain the architectural reason for the phase, not just the files changed.
- Focused tests for that phase pass.
- Direct stream consumption still works.
- Subscription delivery still works.
- No TUI/E2E-only timing assumptions were introduced.
- No public API was expanded beyond the phase goal.
- Any blocked/accepted/rejected behavior is explicitly tested.
