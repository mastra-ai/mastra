# Evented Engine Restoration — Phase Plan

## Context

The enablement experiment (already on `fix/22636`) proved EventedAgent *can* run on the evented engine and produced a precise defect list. This plan turns that list into ordered, shippable work across three tracks: **A** ship-now fixes, **B** evented-engine correctness, **C** dogfooding in mastracode. Research is complete; every item below cites the exact fix surface.

## Findings → fix surface (research summary)

| # | Symptom | Root cause | Fix surface |
|---|---------|-----------|-------------|
| 1 | #22636 crash: `Cannot read properties of undefined (reading 'messages')` on default-engine restart | Running-history pruning strips `messageListState` from predecessor; restart derives input from pruned predecessor because the fallback gate only checks `isResumedStep` | `workflows/default/handlers/entry.ts:306` — widen only the `getResumeStepPrevOutput()` gate; **do not** touch the `stepExecutionPath` push at 307–309 (restart pre-populates it, `RestartExecutionParams.stepExecutionPath`, types.ts:56 — widening the shared var would duplicate-push) |
| 2 | Evented resume: `finishData` null in 3 conformance tests | **Same pruned-predecessor family as #22636**: `EventedRun.resume()` republishes pruned `snapshot.context` as `stepResults` (evented/workflow.ts:2475); `durable-llm-mapping` crashes on missing `messageListState`; error swallowed as an unwatched error chunk | Evented input-derivation path needs the same active-step-payload fallback |
| 3 | Evented crash-restart: `Execution path is empty: []` (Battery 6) | activePaths/activeStepsPath written only at step-end (WEP index.ts:678); initial + nested snapshots start empty (index.ts:1627–1629); no running step-result entry with payload | Persist activePaths/activeStepsPath + running stepResult **before** `stepExecutor.execute()` (WEP index.ts:1753), mirroring default engine's step.ts:174 |
| 4 | Transport split: suspend/finish events never reach agent listener when agent pubsub ≠ mastra.pubsub | `EventedWorkflow.createRun()` has no `pubsub` param (evented/workflow.ts:1741–1745); `EventedRun` uses `mastra.pubsub` exclusively (8 refs); step-executor injects `mastra.pubsub` via PUBSUB_SYMBOL | createRun/EventedRun pubsub plumbing **or** subscriber-side CachingPubSub (see Phase 2 decision) |
| 5 | `emitStepEvents`/`sharePubsub` silently ignored (0 refs in evented runtime); `validateInputs`, snapshot options, tracingPolicy, lifecycle callbacks forward fine | Options never honored | Honor or document-as-unsupported when touching transport |
| 6 | Silent hang/failure when no Mastra registered | Factory non-null-asserts `params.mastra` (evented/workflow.ts:1676, 1678); `EventedRun` throws but fire-and-forget converts throw → unwatched error chunk | Loud synchronous throw at factory construction + agent layer |
| 7 | 6 "pre-existing" conformance failures on **both** engines | Harness drift: 5 assert flat `options.temperature` (current shape is `options.modelSettings.temperature`, per core's own tests + serialize-state.test.ts:192); 1 asserts `sensitiveData` excluded (current design intentionally serializes `requestContextEntries`, only auth token excluded) | Update harness domain assertions |
| 8 | 5 conformance tests measure harness, not engine (foreach ×3, callbacks onFinish, suspend-only) | No Mastra instance constructed (`needsStorage` gating in factory.ts:123; evented leg same) | Evented harness leg always constructs `Mastra({ pubsub: sharedPubSub, storage: MockStore })` |
| 9 | Conformance suite (242 tests/leg) never runs in PR CI | `workflows/_test-utils` + `workflows/inngest` vitest configs lack `name:`; CI selectors `--project 'unit:*'` match names, not directory paths | Add `name:` fields; note Inngest spawns `inngest-cli dev` → must be `e2e:`, not `unit:` |
| 10 | Dogfooding viability | mastracode coding agent = plain `Agent` in `AgentController`; `DurableAgent extends Agent` (durable-agent.ts:541) so type-compatible; controller drives via `sendSignal` (session.ts:3433) which is base-Agent API DurableAgent registers with (durable-agent.ts:2030); controller's internal Mastra receives `config.pubsub` (agent-controller.ts:950) → **transport aligned out of the box** | Flag-gated agent swap in mastracode factory |

## Phase 1 — Track A: ship-now fixes (independent of engine work)

**1. #22636 fix (P0 — user-facing crash)**
- `entry.ts`: compute a separate `isRestartedActiveStep = Boolean(restart?.activeStepsPath?.[stepId])`; pass `isResumedStep || isRestartedActiveStep` **only** into `getResumeStepPrevOutput()`. Leave the `stepExecutionPath` push gated on the original `isResumedStep`.
- Regression test next to `recover-run`/`recover-active-runs` tests: construct a mid-run snapshot with pruned predecessor + active step payload (pattern: parallel-nested-restart snapshot test); assert restart doesn't crash and the active step receives its recorded payload.
- Changeset: patch `@mastra/core`.

**2. Harness drift (cheap, unlocks honest signal)**
- Update 5 temperature assertions in shared domains to nested `options.modelSettings?.temperature`.
- Update requestContext domain to current design: `requestContextEntries` present, auth token excluded.
- Exit: DurableAgent conformance leg fully green (248/248).

**3. Harness Mastra alignment (evented leg)**
- `evented-executor.test.ts`: always construct `Mastra({ logger: false, storage: new MockStore(), pubsub: sharedPubSub, agents })` — not conditional on `needsStorage`. (Keep default leg conditional; backward compatible.)
- Exit: the 5 Class-2 tests become real engine measurements; the evented leg's failure list is honest engine signal.

**4. CI gating (P0 — the reason regressions accumulated unnoticed)**
- `workflows/_test-utils/vitest.config.ts`: add `name: 'unit:workflows/_test-utils'` (pure in-process, safe for PR CI).
- `workflows/inngest/vitest.config.ts`: add `name: 'e2e:workflows/inngest'` (requires `inngest-cli dev` server; must not block PR unit lane). Verify the e2e lane's environment can supply the CLI before enabling.
- Check `workflows/temporal` config while there.
- Exit: `--project 'unit:*'` picks up the conformance suite on PRs.

## Phase 2 — Track B: evented engine correctness (ordered; each unblocks the next)

**5. Transport unification**
- Decision point: **Option A** (plumb `pubsub` param through `createRun()`/`EventedRun`) is in-process only; **Option B** (CachingPubSub subscribes to `mastra.pubsub` — subscriber-side caching) survives cross-process workers and closes the replay gap. Recommend B; keep the Mastra requirement.
- Replace non-null assertions at factory construction (evented/workflow.ts:1676, 1678) with a loud synchronous throw; add the same guard in `DurableAgent.getWorkflow()`/`executeWorkflow()` before the fire-and-forget chain so missing-Mastra fails at call time, not as a buried error chunk.

**6. Pruned-predecessor fallback on the evented resume path**
- Same fix family as item 1: when deriving step input from event-carried `stepResults`, fall back to the active/suspended step's own recorded payload when the predecessor entry is pruned.
- Verify with the 3 resume conformance tests (tool-approval resume/denial, in-execution resume) after item 5 lands.

**7. Mid-step activePaths + running step-result recording**
- Persist `activePaths`/`activeStepsPath` and a running step-result entry (with payload) before `stepExecutor.execute()` in the WEP, for both top-level and nested snapshots. Nested-run recovery lookup via `metadata.nestedRunId` (pattern exists in codebase).
- Exit: Battery-6-style repro (two-process kill/restart mid-LLM-call) recovers on evented.

**8. Option honoring**
- While touching transport: honor `emitStepEvents: false` and `sharePubsub`, or explicitly document them as unsupported on evented and strip them from the durable factory's evented branch.

**9. Crash-recovery conformance domain**
- Add a restart/recovery domain to the shared harness (currently none exists — the suite cannot certify the one capability EventedAgent exists for). Run it on default + evented; skip-configure Inngest if not applicable.
- Exit criteria for Phase 2: EventedAgent conformance leg green (minus intentionally-skipped domains), recovery domain green on both engines, `workflows/evented` baseline still green.

## Phase 3 — Track C: dogfooding in mastracode

**10. Flag-gated agent swap** (can start immediately, before Phase 2)
- Config flag in the mastracode factory: wrap the coding agent in `EventedAgent` before handing to `AgentController`. Type-compatible; controller's internal Mastra already shares the pubsub.
- Sequencing: dogfood on the **default** engine now — exercises the durable loop + fire-and-forget under real load and validates the #22636 fix. Flip the flag to evented after Phase 2 for the real soak test.

**11. First-session validation checklist (targets the unverified interplay)**
- Chat streaming; interjections (`sendSignal` mid-run — durable-loop signal consumption is the biggest unknown); tool approvals (controller approval flow vs durable suspension); kill/restart + `recoverActiveRuns()`; subagents unaffected.

## Phase 4 — Validation & stability claim

- Full battery re-run: both conformance legs, `agent/durable` suite, `workflows/evented` baseline, #22636 repro, Studio smoke (mastra-smoke-test skill).
- Soak/repeat runs — the earlier assessment ran everything once, in-process; "stable" requires repeated behavior under load. Dogfooding (Phase 3) is the soak vehicle.
- Docs + changesets for everything that ships; fix the EventedAgent docblock to match reality.

## Prioritization

- **P0**: item 1 (user-facing crash), item 4 (CI gap lets regressions slip silently).
- **P1**: items 2–3 (cheap), items 5–7 (engine correctness, ordered).
- **P2**: items 8–9, dogfooding infra (10–11).

## Risks / out of scope

- Interjection + approval-gate semantics on the durable loop are unverified — Phase 3 checklist targets them deliberately; a failure there is new information, not a blocker for Phases 1–2.
- Out of scope: temporal package test health, parameterizing the ~780-test core durable suite across engines (the shared harness is the cross-engine vehicle), fixing Inngest e2e infra beyond naming.
