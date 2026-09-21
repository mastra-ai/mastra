# PR #24569 change gotcha checklist

Date: 2026-09-21
Status: mandatory for all remaining work on `unified-agent-loop`
Applies to: code changes, tests, conflict resolutions, review-comment fixes, behavior changes, refactors, and review replies

## Mandate

Every remaining change for PR #24569 must pass this checklist before implementation and again before commit. If a change fails a rule, stop and redesign it. Do not waive a rule because the current code already uses the unsafe pattern or because copying an existing implementation is easier.

Each change must leave a short evidence record using the template at the end of this document. Evidence can live in the planning document, task notes, test name, commit summary, or review reply, but it must be concrete and source-verified.

## 1. Do not use in-memory state as durable truth

### Rule

Do not add a process-local map, set, registry, cache, closure, Promise, or singleton as the authoritative source for state that must survive replay, restart, failover, or cross-process execution.

### Required checks

- [ ] Does the state need to survive a process restart or workflow replay?
- [ ] Does another process need to observe or update it?
- [ ] Is the authoritative value persisted in background-task storage, workflow state, transcript metadata, or another durable store?
- [ ] If in-memory coordination is used, is it limited to optimizing or synchronizing the current live attempt?
- [ ] Can correctness still be reconstructed after every in-memory value disappears?
- [ ] Are live handles, callbacks, Promises, MessageList instances, or executor closures kept out of workflow step schemas?

### Stop condition

Stop if correctness depends on finding an entry in a process-local structure after replay or process loss.

## 2. Review the change as DurableAgent behavior

### Rule

A review finding is not valid merely because it is valid for the regular agent loop. Explain how the failure occurs in DurableAgent's execution model and verify that the proposed fix remains correct under persistence, replay, and cross-process execution.

### Required checks

- [ ] What is the concrete DurableAgent failure?
- [ ] Which persisted state machine owns each relevant value?
- [ ] What happens if the process exits immediately before this line?
- [ ] What happens if the process exits immediately after this line?
- [ ] Can the workflow step replay after the external action already occurred?
- [ ] Can a second process complete the work?
- [ ] Does the fix preserve suspend, resume, restart, abort, and retry behavior?
- [ ] Does the transcript contain exactly one authoritative result after replay?
- [ ] Does the review concern belong in this PR's parity/refactor scope, or is it unrelated pre-existing behavior?

### Stop condition

Stop if the proposed fix has only been reasoned about as a normal function call or a single-process stream.

## 3. Reconstruct the workflow context before changing workflow code

### Rule

Do not edit workflow, durable-agent, background-task, or step-execution code until the relevant workflow lifecycle has been written down. Agents tend to reason locally and miss the persisted state transitions around the local code.

### Required context

Before editing, identify:

- [ ] the event or call that starts this path;
- [ ] the workflow step input and output;
- [ ] the serialization/checkpoint boundary;
- [ ] the persisted records involved;
- [ ] runtime-only state that disappears on restart;
- [ ] the callback, event, or poll that marks completion;
- [ ] replay, redelivery, or duplicate-delivery behavior;
- [ ] ownership of actor, request context, abort signal, and run identity;
- [ ] the exact point at which the transcript becomes authoritative;
- [ ] the tests that exercise the real workflow path rather than a local helper only.

### Stop condition

Stop if the implementation assumes a closure, callback, MessageList, actor, request context, or task handle automatically survives a workflow boundary.

## 4. Do not get attached to existing logic

### Rule

Existing code is evidence, not the specification. Preserve behavior only after proving it is intentional and correct for the durable architecture.

### Required checks

- [ ] What user-facing or persisted invariant should hold?
- [ ] Is the existing implementation deliberate, accidental, or compensating for an older limitation?
- [ ] Does copying the regular loop import single-process assumptions?
- [ ] Does copying the durable loop preserve a known parity gap?
- [ ] Is there a smaller design based on persisted invariants rather than current control flow?
- [ ] Are we preserving behavior because tests prove the contract, or only because the code is already there?
- [ ] If current logic conflicts with the durable invariant, have we stated that directly instead of designing around it?

### Stop condition

Stop if the primary justification is "this is how the other engine does it" or "this is how the code already works."

## 5. Verify provenance: net-new, changed, or pre-existing

### Rule

Before calling something a regression or attributing it to this PR, verify its history. Classify both the behavior and the specific code under review.

### Required checks

- [ ] Does the behavior exist on `origin/main`?
- [ ] Does it exist at the branch merge base?
- [ ] Which commit introduced the relevant code or contract?
- [ ] Did a merge import one side of a contract without updating the other consumer?
- [ ] Is the current line net-new, moved, refactored, or byte-for-byte pre-existing?
- [ ] Did this PR introduce the failure, expose it, preserve it, or merely make it easier to see?
- [ ] Does the review reply use that precise classification?
- [ ] Has an independent source/history check confirmed the classification before implementation?

### Required classification

Use one of these labels:

- **Net-new defect:** the PR introduced the failing behavior.
- **Net-new integration gap:** the PR introduced or changed a shared contract but did not update every consumer.
- **Pre-existing defect in touched code:** the behavior exists on main, but this PR materially edits or consolidates the path.
- **Pre-existing and out of scope:** the behavior exists on main and the PR does not materially change the responsible path.
- **Intentional difference:** source, tests, or documented invariants prove the behavior is deliberate.
- **Unproven hypothesis:** no supported failure case has been demonstrated yet.

### Stop condition

Stop if the change is being justified as a PR regression without Git-history evidence.

## 6. Require a concrete failure case

### Rule

Do not implement a fix based only on a plausible concern. First demonstrate a supported topology and an observable incorrect outcome.

### Required checks

- [ ] What exact input, state, event order, or crash point triggers the failure?
- [ ] What incorrect persisted state, stream event, transcript, or model-visible result follows?
- [ ] Does the failure reproduce on the supported engine and topology under review?
- [ ] Is the failing test exercising the real path closely enough to prove the issue?
- [ ] Does the proposed regression test fail before the fix for the expected reason?
- [ ] Could the finding instead be a type cleanup, unsupported topology, or intentional authorization boundary?

### Stop condition

Stop if the only evidence is "this could happen" without a concrete supported execution path.

## Change workflow

### Before implementation

- [ ] State the concrete failure.
- [ ] Classify provenance.
- [ ] Write down the durable workflow lifecycle.
- [ ] Identify persisted truth and runtime-only state.
- [ ] Decide whether the change is small conflict/review cleanup or substantive logic.
- [ ] Confirm that the proposed scope matches what the user approved.
- [ ] Add or identify the red regression test.

### During implementation

- [ ] Keep persistence and replay decisions visible in code and tests.
- [ ] Add no in-memory durability substitute.
- [ ] Make the smallest change that satisfies the persisted invariant.
- [ ] Preserve unrelated engine behavior.
- [ ] Re-evaluate the design if a new shared API or storage field becomes necessary.

### Before commit

- [ ] Run the focused regression test and prove red/green behavior when practical.
- [ ] Run the relevant durable, loop, workflow, or background-task suites.
- [ ] Run typecheck, formatting, and lint for the touched package.
- [ ] Inspect the final diff against `origin/main` and the merge base.
- [ ] Re-run this checklist against the final implementation, not the original plan.
- [ ] State whether the commit contains big logic changes or small contained fixes.
- [ ] Keep unrelated planning documents and changes out of the commit.
- [ ] Do not push unless the user explicitly asks.

## Per-change evidence template

Copy this section into the relevant planning note or completion summary:

```md
### Gotcha check: <change name>

- Concrete failure:
- Durable workflow path:
- Persisted source of truth:
- Runtime-only coordination:
- Replay/crash behavior:
- Provenance classification:
- Git evidence:
- Existing logic rejected or retained, and why:
- Regression test:
- Scope classification: small contained fix | substantive logic change
- Verification:
- Remaining uncertainty:
```

## Current application: awaited disposition

- **Concrete failure:** DurableAgent returns a running placeholder for an awaited background tool and lets the model continue without the terminal result.
- **Durable path:** evented tool-call workflow step plus separately persisted background task and transcript.
- **Persisted truth:** exact background-task record plus workflow/transcript state.
- **Runtime-only coordination:** `waitForCompletion()` and a reconciliation Promise may coordinate the live attempt but cannot recover it.
- **Provenance:** pre-existing DurableAgent defect carried into a net-new shared dispatch contract, making it a net-new integration gap in the refactor surface rather than a wholly new defect.
- **Existing logic:** regular-loop awaited behavior is reference material, not a durable replay specification.
- **Required first proof:** red durable-step test showing that awaited currently returns the placeholder.
- **Scope:** substantive logic and recovery work; separate commit; no push without explicit instruction.
