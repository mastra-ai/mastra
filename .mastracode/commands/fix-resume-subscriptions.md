---
name: fix-resume-subscriptions
description: Implement the phased subscription-owned resume and stream identity architecture, one committed phase at a time
goal: true
---

# Fix resume/subscription integration

Implement the phased plan for making suspended-tool resume, tool approval, thread subscriptions, live UI rendering, and steering signals work together with one clear ownership model.

Primary plan:

- `.dev/thread-runtime-architecture/plan.md`

Supporting architecture docs:

- `.dev/thread-runtime-architecture/resume-stream-existing-architecture.md`
- `.dev/thread-runtime-architecture/subscription-signal-runtime-architecture.md`
- `.dev/thread-runtime-architecture/ideal-integrated-resume-subscription-architecture.md`

## Goal

Complete the phases in `.dev/thread-runtime-architecture/plan.md` in order, from smallest runtime surface area to largest UI/E2E surface area, proving each phase before moving to the next.

The implementation is complete only when:

- `resumeStream()` remains the direct-consumer API and returned streams are not stolen by subscriptions.
- `sendStreamResume()` exists as the experimental subscription-owned resume API.
- `sendToolApproval()` and generic tool resume share the same subscription-owned resume path.
- Same-run resumes are distinguished internally by `streamId` / `streamSeq` while preserving `runId`.
- Generic suspensions are first-class runtime state, not approval-only exceptions.
- Subscriber delivery preserves tool results and resumed output across non-final stream boundaries.
- Steering/signal routing captures intent synchronously and does not become idle after awaits.
- Suspended/resuming runs block unrelated idle messages instead of silently starting new model turns.
- The TUI displays pending/steer/abort state from authoritative runtime/Harness events, not optimistic guesses.
- Live `request_access`, steering during resumed streams, and abort behavior work without reloads or duplicate output.

## Required reading before changing code

1. Read `.dev/thread-runtime-architecture/plan.md` end to end.
2. Read the three linked architecture docs enough to understand the baseline and target model.
3. Inspect the current code at the reset baseline before editing:
   - `packages/core/src/agent/agent.ts`
   - `packages/core/src/agent/thread-stream-runtime.ts`
   - relevant Harness files/tests under `packages/core/src/harness/`
   - relevant MastraCode TUI/session files only when a later phase reaches UI integration.

## Non-negotiables

- Follow the phases in order.
- Each phase must land as one or more focused commits before starting the next phase.
- Do not carry uncommitted phase work across phase boundaries.
- Commit messages must explain the architectural reason for the phase, not just the files changed.
- Do not use timing-heavy MastraCode E2E as the primary proof.
- Do not add TUI-only active-state hacks to hide runtime state bugs.
- Do not silently wake idle model turns while a thread is blocked by a suspended/resuming run.
- Do not mutate getter-only model output objects.
- Do not broaden public API beyond the phase goal.
- Keep changes surgical because many packages depend on `packages/core`.

## Phase workflow

For each phase in `.dev/thread-runtime-architecture/plan.md`:

1. Re-read that phase and its required proof.
2. Create or update the task list for only that phase.
3. Inspect current implementation and nearby tests before editing.
4. Make the smallest production change that satisfies the phase.
5. Add or update focused tests listed by the phase.
6. Run the phase's verification commands.
7. Fix failures at the root cause, not by weakening tests or adding timing sleeps.
8. Confirm no debug traces, instrumentation files, or generated artifacts are left behind.
9. Commit the completed phase before starting the next one.
10. Summarize what changed, what passed, and what risk remains.

If a phase reveals that the plan is materially wrong, stop and update the plan/docs first instead of improvising a broad runtime rewrite.

## Phase summary

Use the full phase details and exact verification commands from `.dev/thread-runtime-architecture/plan.md`. This summary is only a quick index.

### Phase 0 — Baseline lock and regression fixtures

Freeze the reset baseline and add focused failing/protective tests that describe known bugs. Do not leave committed failing tests outside an active fix phase.

### Phase 1 — Stream ownership guardrails

Ensure thread subscription broadcast cannot steal or pre-consume streams returned by direct APIs. Preserve direct `agent.stream()` and `resumeStream()` consumption.

### Phase 2 — Internal stream identity

Introduce internal `streamId` / `streamSeq` so subscriber dedupe and stale cleanup distinguish concrete stream registrations from logical `runId`.

### Phase 3 — First-class suspended run lifecycle

Model generic suspended runs as first-class runtime state. Suspended/resuming runs should block unrelated idle wake while still allowing resume/control input.

### Phase 4 — Subscriber boundary semantics

Make subscription delivery correct across non-final boundaries such as `finish(tool-calls)` and `tool-call-suspended`, without background-draining subscriber-visible parts.

### Phase 5 — Add experimental `sendStreamResume()`

Add a subscription-owned resume API that returns acknowledgement only, registers a new internal stream identity for the same `runId`, and preserves existing `resumeStream()` semantics.

### Phase 6 — Move Harness resume/approval paths onto `sendStreamResume()`

Remove the Harness smell where generic suspended-tool resume calls `resumeStream()` and ignores the returned stream. Align `sendToolApproval()` with the same subscription-owned primitive.

### Phase 7 — Signal target capture and blocked idle behavior

Capture signal intent synchronously at submit time and carry it through awaits. Define and test explicit blocked/stale fallback behavior.

### Phase 8 — TUI/display state integration

Render pending/steer/abort state from authoritative runtime/Harness events. Steering should not be optimistic.

### Phase 9 — End-to-end smoke and full core confidence

Use E2E and manual smoke as final confirmation, not primary proof.

## Verification baseline

Prefer the narrowest phase-specific commands from the plan. Common checks include:

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core -- --run packages/core/src/agent/__tests__/agent-signals.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/agent/__tests__/stream.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-tool-suspension.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/harness-ask-user.test.ts --bail 1 --reporter=dot
pnpm test:core -- --run packages/core/src/harness/__tests__/signal-messages.test.ts --bail 1 --reporter=dot
```

Before final completion, run the narrowest relevant full confidence checks for touched packages. For core-heavy changes, that usually includes:

```bash
pnpm build:core
pnpm --filter ./packages/core check
pnpm test:core
```

If touching MastraCode/TUI, also run focused MastraCode unit/E2E checks from the plan after core proof exists.

## Progress tracking

Maintain a visible task list while working. At the end of each phase, report:

- commits created;
- files changed;
- tests/checks run;
- whether the phase exit checklist passed;
- the next phase to start.

## Extra guidance

Apply any additional user guidance below as constraints on scope, phase selection, or verification:

$ARGUMENTS
