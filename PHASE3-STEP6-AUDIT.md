# Phase 3 Step 6 — Parity Audit (report only)

Status: **diff-reads complete, review approved — porting in progress.**
All `STRAGGLER?` rows in the tables below have been adjudicated; see **"Tier 2 diff-read results"**, which supersedes the table marks.

## Background — what this audit is for

**End goal:** re-enable EventedAgent (removed Jul 16, 2026 for instability). It failed because the evented engine was bolted onto the main agent loop — a loop that lives inside one HTTP request with live closures (stream controller, tools, messageList). The evented engine's point is process-death survival and fire-and-forget cross-process execution; its natural host is the **durable loop**, where every step boundary is a serialization checkpoint.

**The obstacle:** the durable loop forked from the main loop on 2026-04-30 (#12557) and both evolved in parallel for 4+ months with no porting mechanism (113 main-only / 99 durable-only / 52 shared commits). Putting EventedAgent on the durable loop as-is would inherit every stale gap.

**The plan:**
- *Phase 1 (done):* crash fix #22636, port live bugs (#22273, #22363), harness alignment, CI gating.
- *Phase 3 (done, Commits A–O3):* make divergence structurally hard — builder hierarchy (`AgenticLoopBuilder` → `DurableAgenticLoopBuilder`), every step's behavior hoisted once into `loop/shared/steps/*` cores with thin engine glue. Each difference adjudicated: *drift* (unify) vs *deliberate* (named hook + ledger row L1–L18), justified against constraints C1 (serialization at step boundaries), C2 (pubsub instead of request-scoped stream), C3 (first-class suspension), C4 (shared workflow graph).
- *Phase 2 (pending):* fix the evented engine itself on the unified loop (items 5→7→6→8→9). Exit gate: EventedAgent 242/242, DurableAgent 248/248, two-process crash recovery.

**This audit (Step 6):** hoisting fixed the *future* (fixes land once) but never swept the *past* — the historical backlog of one-sided commits. Sweeping before Phase 2 means (1) Phase 2 conformance failures point at the evented engine, not stale drift; (2) ports are cheap now — most candidates collapse against the shared cores. Per the audit-first gate (post-L18 lesson: commit-title triage can be wrong), this report was produced with **zero code changes** and reviewed before porting began.

**Outcome:** 183 non-test divergent commits reduce to **8 durable ports + 1 main adoption + 1 ledger row** (see "Final straggler list").

## Method

- Range: `f8694b6fa0` (#12557, durable fork, 2026-04-30) → `1778103420` (merge-base of `fix/22636` with `origin/main`). Our 24 Phase 3 branch commits are excluded by construction (they're not in this range).
- Path sets: main loop = `packages/core/src/loop/`, durable = `packages/core/src/agent/durable/`.
- Sets: 165 commits touched loop, 151 touched durable, **52 touched both** (already-parallel work, excluded), leaving **113 main-only** and **99 durable-only**.
  - Earlier "65/106" estimate came from a narrower path selection; this audit supersedes it.
- Mechanical eliminations: 18 main-only and 11 durable-only commits are **test-only within the audited paths** (src changes, if any, live in shared code outside the loop fork — e.g. #19290 StreamErrorRetryProcessor lives in `processors/`, #17602/#21563 in the stream/model layer).
- Key structural facts verified by grep, which collapse whole families:
  - Durable `llm-execution.ts` **imports `buildMessagesFromChunks` from the main step dir** → every buildMessagesFromChunks fix is shared-by-construction (#16073, #20488, #20716, #18534-part).
  - `stopWhen` evaluation and `normalizeModelOutput` (incl. #16449/#17879 media fixes) live in `loop/shared/` → both engines share them post-hoist.
  - `prune-snapshot.ts` is used by durable runs (several "DurableAgent" titles landed there) → snapshot-growth family is shared (#21002, #21390, #21537, #22123, #22127, #22123).
  - `processors/runner.ts` is shared → all processor-implementation fixes reach both engines; only *invocation sites* can drift.

## Disposition legend

- **MOOT-HOIST** — behavior now lives in a shared core from Commits A–O3.
- **MOOT-SHARED** — fix landed in a file/module both engines execute.
- **MOOT-PORTED** — already ported on this branch (Phase 1).
- **MOOT-REVERT** — commit + revert pair, net zero.
- **SUPERSEDED** — evented-engine enablement work replaced by Phase 1–3.
- **ENGINE** — engine-specific surface by design (no port target exists).
- **PARALLEL** — both engines fixed the same problem independently; equivalence assumed, spot-check only.
- **LEDGER** — deliberate policy divergence; document, don't port.
- **DEFER-P2** — belongs to Phase 2 scope.
- **STRAGGLER** — confirmed missing on the other engine.
- **STRAGGLER?** — candidate; needs a diff-read before deciding.

## Main-only (95 non-test commits)

| Commit | PR | Disposition | Note |
|---|---|---|---|
| 3d7f709b61 | #15978 tool concurrency from active tools | PARALLEL | durable resolves concurrency per-run (C4, #19329) |
| e24aacba07 | #16071 filter delegated stream chunks | ENGINE (L1) | main stream driver; durable adapter had #18191/#21224 |
| 86c0298e64 | #15410 FGA enforcement | PARALLEL | durable handles denials via #19886 |
| d1fdbd012a | #16176 provider-boundary prompt processor hook | **MOOT-PARALLEL** | durable already invokes it — ported via #18712 (DurableAgent parity Phase 4). Audit grep missed it because the commit message says `processLLMPrompt` but the code identifier is `processLLMRequest`. Durable `llm-execution.ts:632-724`: builds ProcessorRunner from `llmRequestInputProcessors`, calls `runProcessLLMRequest`, uses rewritten prompt (`inputMessages = requestStepResult.prompt`, line 682), honors cache short-circuit + tripwire bail + error propagation; shares runner with `processLLMResponse` |
| 087e4133e5 | #16246 Azure Responses routing | MOOT-SHARED | model layer |
| aebde9cfac | #16073 part ordering | MOOT-SHARED | buildMessagesFromChunks |
| 4df7cc7934 | #16347 MAPPING span | MOOT-HOIST | computeModelOutputProviderMetadata (N) |
| f180e4990e | #16283 ResponseCache processor | MOOT-SHARED | processors/ |
| 0f48ebfc7a | #16103 tool payload projections | MOOT-HOIST | shared tool-payload-transform (L) |
| 55f1e2d654 | #16229 Agent signals | MOOT-HOIST | signal-drain-core (D) |
| b59316ffa0 | #16457 toModelOutput before emission | MOOT-HOIST | N/O |
| ef6b5847ac | #16449 normalize media types | MOOT-HOIST | shared normalize-model-output |
| f984b4d6c6 | #16231 follow-ups via signals | MOOT-HOIST | signals shared |
| b32ba5fde5 | #16637 scheduled workflow prefix | MOOT-SHARED | infra |
| 75c7c38a4e | #16661 barrel cycle | MOOT | build hygiene |
| 271c044f6b | #16623 signal transcript order | MOOT-HOIST | signal-drain-core |
| 2f5f58a9a8 | #16425 client tool tracing | MOOT-HOIST | execute-tool-core (I) |
| c624361369 | #16873 exact hash matching | STRAGGLER? | 1-line diff-read to classify |
| 8c31bcdb00 | #17342 BatchParts final part | MOOT-HOIST | drainReprocessParts ported (M) |
| 212c635203 | #17338 OM replay timestamps | MOOT-SHARED | MessageList/memory |
| 95b14cdd82 | #16950 tagged system messages | MOOT-SHARED | processor runner |
| 50ed00caa9 / 6e28fcb829 | #17368/#17389 | MOOT-REVERT | pair |
| 8ace89df77 / 83b6cfafa8 | #16976/#17388 | MOOT-REVERT | pair |
| da5c5a00fd / 6aaf5970d5 | #17403/#17422 | MOOT-REVERT | pair |
| cefca33ae6 | #17354 payload lookup perf | ENGINE | main stream path perf |
| 9283971570 | #16687 step lifecycle chunks → processors | LEDGER → L19 | behavior inherited via shared `processPart`; injection plane deliberate (#21529) |
| 94dfef6e2b | #17370 processor state across lifecycle chunks | LEDGER → L19 | same policy divergence |
| a34d9dbc39 | #17497 working memory via state signals | MOOT-HOIST | is-task-complete core (F) |
| 493a328f43 | #16796 evented loop | SUPERSEDED | |
| 575f815c5c | #17727 idle-start errors + localOnly | DEFER-P2 | transport, Item 5 |
| bf8eb6d0ec | #17487 actor propagation | PARALLEL | durable has actor tests |
| dd6a66ea0b | #17858 stale snapshot rows | PARALLEL | durable #22266 |
| d785c593b6 | #17893 content-filter refusal handling | **STRAGGLER** | grep: absent in durable llm-execution |
| 3ef01fd130 / 02087e1fbc / 1274eb3a95 / 54a51e0a48 / 3a8024ce61 / b13925bfa9 | goal family | MOOT-HOIST | goal-core (G) |
| d9d2273c70 | #18105 signal ordering | MOOT-HOIST | |
| 8e25a78e05 | #18243 parallel tool calls concurrent | PARALLEL | |
| bf94ec6819 | #18275 CI fixes | MOOT | |
| 975c59ae36 | #17836 serialization-safe loop | SUPERSEDED | RunScope infra = Step 7 de-scar target |
| f3f0c9d7c8 | #18041 parallel sub-agent delegation approvals | PARALLEL | durable #20492/#20502/#20529 |
| 86623c1adf | #17832 channels per-run processor | PARALLEL | durable #22327 |
| e545228569 | #18432 step providerMetadata → output-step processors | STRAGGLER? | verify durable runProcessOutputStep call |
| 87f38a3de0 | #18500 reasoning modelSettings, router V4 | MOOT-SHARED | |
| 58e287b1ed | #17898 suspended-run discovery | PARALLEL | durable #19713 |
| 60139c2a7f | #18542 makeCoreTool mastra/memory for processor-added tools | STRAGGLER? | check durable llm-execution makeCoreTool args |
| b8375c1f8f | #18534 persist reasoning | MOOT-SHARED / PARALLEL | durable #19408 |
| d1c930f713 | #19009 stopWhen∘maxSteps | STRAGGLER? | fix is in agent option assembly; verify durable preparation composes too |
| 1d39058e54 | #19103 forward toolPayloadTransform | MOOT-HOIST | L8 |
| dce50dc9a1 / 73839cb583 / 9d3073c230 | naming/lint/CVE | MOOT | |
| 3e26c87de0 | #18628 background task chunks | MOOT-HOIST | J/K |
| 1ce512155d | #19255 cancelled vs completed tasks | MOOT-HOIST | background-task-check core (E) |
| aa38805b87 | #19383 Retry-After bounds | MOOT-SHARED | processors/ |
| de86fd7119 | #19454 toolResults in onIterationComplete | MOOT-HOIST | ladder hoisted post-fix; quick verify |
| ef03c0cfc6 | #18666 drop evented remnants | SUPERSEDED | |
| c3287698ff | #19749 studio | MOOT-SHARED | |
| df6a9ce872 | #19769 channel approvals on parent run | PARALLEL | |
| 06000d7371 | #19375 persist processor data chunks | STRAGGLER? | durable llm-execution pipeline |
| cadaa1372e | #19645 delegated approvals after refresh | PARALLEL | durable #20492 |
| 594f7b28f5 | #19486 don't mutate persisted msg on approval resume | STRAGGLER? | |
| 93e28ecce9 | #20487 never execute declined tools | STRAGGLER? | |
| d8fa2430d2 | #16012 processToolResult hook | MOOT-HOIST | O3 wired durable |
| 01b162fe43 | #20488 metadata-only text deltas | MOOT-SHARED | |
| 049448906e | #20346 readOnly during tool suspension | STRAGGLER? | cross-check with durable readOnly family + R1 |
| e3b9307098 | #20700 parallel delegation approval targets | PARALLEL | |
| 45bfb88fd5 | #20716 provider tool errors in history | MOOT-SHARED | |
| 0023e79194 | #18034 aborted tool calls | MOOT-HOIST | I/N |
| 333785c93c | #21001 background real result | MOOT-HOIST | K |
| a8b4cf0282 / 161258b347 / 9ef432b6fa / 8dc408d344 / d29d06fe00 | snapshot-growth family | MOOT-SHARED | prune-snapshot.ts used by durable |
| 66bbfb5f05 | #20347 route concurrent workflow approvals | STRAGGLER? | vs durable #20529 |
| e1cead17b5 | #20302 provider finish error, no payload | STRAGGLER? | |
| a40f915769 | #21449 preserve actionable API errors | STRAGGLER? | |
| b860493911 | #21724 modelSettings.timeout | STRAGGLER? | durable has engine step-timeout (#22287); semantic parity unclear |
| 7fc880627d | #21688 completed results while browser tool pending | STRAGGLER? | structural — durable suspends at tool-call |
| d438148e22 | #21319 clear suspension metadata on resume | STRAGGLER? | |
| 038b7b405c | #21738 processors vs recovered errors | STRAGGLER? | |
| 1a485f3538 | #22119 input-step processors real content | STRAGGLER? | |
| 575e343900 | #22128 resume on started version | **PORTED** (6dfeb5a6a6) | confirmed straggler: cold resume rebuilt registry state via `this.prepare()` from whatever version `this` currently is; warm resume was already safe (registry entry keeps started-version state). Reachable: stored agents can be durable (`createAgentFromStoredConfig` → `createDurableAgent` when `durable` truthy), server resolves the resume-target agent by current status. Port: pin rides `DurableAgenticWorkflowInput.agentVersionId` (producer: preparation, from wrapped rawConfig); `resume()` cold branch re-resolves `{versionId}` via `resolveVersionedAgent` and delegates to the fork. Precedence mirrors main: explicit call-site versionId wins; `__isStoredVersionApplied()` gate (new internal Agent accessor) + resolved-id equality terminate recursion; deleted pin warns + falls back. Bonus supply-path fix: DurableAgent now delegates `toRawConfig`/`__setRawConfig` to the wrapped agent — the editor's post-`applyStoredOverrides` version stamp previously landed on an unread outer field, so versioned durable forks lost version metadata in preparation, resume/recover spans, and server agent-detail serialization. 9 regression tests mirroring main's root-version-resume spec; 4 fail without fix. |
| 9a12ef3fcc | #21947 call-time model retry settings | STRAGGLER? | durable has own maxRetries plumbing; check call-time flow |
| 3e8727e11e | #22273 | MOOT-PORTED | Phase 1 |
| 9ee8120ce1 | #22262 resume de-dup warnings | MOOT-SHARED | engine infra |
| 7960688828 | #22277 writer.custom frames on resume | STRAGGLER? | L1 territory; check stream-adapter |
| f7a7467819 | #22363 | MOOT-PORTED | Phase 1 |
| ea56b1fa6e | #22887 observe helpers in agent tools | **MOOT-SHARED** | initial grep evidence pointed the wrong way: main's bug was a *forced* `observe: noopObserve` override in tool-call-step; durable never sets `observe` at all (zero matches in durable + loop/shared), so the shared builder fallback `observe: execOptions.observe ?? createToolObserve(toolSpan)` (`builder.ts:660`) applies. Chain: durable passes execution-time `tracingContext` (`tool-call.ts:892`) → shared `executeToolCall` calls `tool.execute(args, toolOptions)` (`execute-tool-core.ts:68`) → builder derives toolSpan from `execOptions.tracingContext` (`builder.ts:816-818`). `createToolObserve` noops only on absent/invalid span — same as main with tracing off. Fix substance lives in shared `observe.ts`/`builder.ts` (in branch history, `git merge-base --is-ancestor` confirmed) with its own tests on the shared path. |

## Durable-only (88 non-test commits)

Grouped — the overwhelming majority is engine-specific surface with no main-loop equivalent:

- **ENGINE (≈60):** DurableAgent/EventedAgent API + lifecycle (prepare/observe/abort/recover/listActiveRuns/untilIdle/idle-timeout: #18191 #18349 #20442 #21009 #21081 #21125 #21224 #21518 #21526 #21527 #21532 #21535 #21572 #21675 #21996 #21889 #22105 #22141 #22145 #22255 #22266 #22781 #22860 #22872 #16599 #16646 #19363 #19418 #19571+), serialization/preparation (#16590 #18751 #20727 #19713 #19750), cross-process tool resolution (#19331), Inngest parity (#18615 #19329 #21572), tracing glue (#16267* #18083 #18344 #19313 #22677), scorers on durable engine (#21038 #21060 #20840 #22878 #22010), thread titles (#19315 #19856 #20996), step-event suppression (#21529 → LEDGER pair with #16687/#17370). *#16267: main llm-execution-step has MODEL_INFERENCE (grep-confirmed) — moot.
- **PARITY-BRIDGE / ports of main behavior (moot):** #18461 #18508 #18677 #18719 #18649 #18856 #18921 #17794 #18113 #18121 #18411 #19371 #19578 #22327 #19408 #20492 #20502 #20529 #19886 #20215 #22243 #21600 #22287.
- **Reverse stragglers (durable → main) to verify:**
  - **R1 — readOnly flush guard** (from #18856/#18921 family): known from Commit K adjudication; main should adopt.
  - **R2 — #22437** server-defined toModelOutput applied to client-supplied tool results: check main's resume path.
  - **R3 — #21377** fire onOutput for client-executed tool results: check main.
  - **R4 — #20404** keep results when toModelOutput returns undefined: probably covered by Commit N core's nullish handling — verify, likely moot.
- **Pre-fork known straggler (from O2):** **#14282** deferred provider-result patch — **PORTED** (0c4e9a2a68). Durable never got the late-result commit for deferred provider tools; after O2's passthrough-gate alignment, deferred results had NO commit path at all (invocation stuck at `state:'call'`). Port mirrors main's llm-execution tool-result case in durable's stream loop, pre-emission (durable emits eagerly): `updateToolInvocation` patches the deferred call to `state:'result'` (same-stream results no-op — no part exists yet, buildMessagesFromChunks handles them); `processToolResult` runs before the raw result is emitted/collected/persisted, with post-processor mutations read back via `readToolResultFromMessageList` and synced into the chunk; processor tripwire breaks stream consumption and joins the shared tripwire bail path (raw value never reaches stream or history); hook writer's data-* chunks persist producer-side per #19375 policy. Pinned by `durable-agent-deferred-provider-result.test.ts` (3 tests, 3/3 fail on old code).

## Tier 2 diff-read results (supersedes STRAGGLER? marks above)

All 19 candidates diff-read against current post-hoist durable code. 4 confirmed stragglers, 15 collapsed.

| PR | Verdict | Evidence |
|---|---|---|
| #21947 retry settings | **MOOT-SHARED** | fix is `maxRetriesConfigured` in `Agent.toFallbackEntry` (shared class); durable's model list is built from those entries (`preparation.ts:701`) |
| #21688 browser-side pending | **MOOT-ARCH (L2)** | main's fix is the llm-mapping flush-before-bail; durable suspends the whole workflow at tool-call — sibling chunks stream live at tool-call time, commits happen at resume; no drop, no client hang |
| #21738 processors vs recovered errors | **MOOT-ARCH** | durable's only model-error emission is post-exhaustion (`llm-execution.ts:1900` "All models exhausted … deferred error chunk"); recoverable per-attempt errors never reach consumers/processors |
| #22119 input-step real content | **MOOT-ARCH** (reclassified during port verification) | audit misread WHERE `buildStepRecord` runs: the state-update `.map` sits after the full iteration pipeline (`durable-loop-builder.ts:429-438`), consuming llm-mapping's output which carries the real `toolResults` (`llm-mapping.ts:271`) and a `messageListState` serialized after the commit loop (`llm-mapping.ts:265`); so `accumulatedSteps[last].toolResults` is never stale when `runProcessInputStep` reads it (`llm-execution.ts:422`). Second hunk (currentIterationContent slicing) also moot: durable builds `_durableStepContent` from iteration-local data, never messageList extraction (`llm-mapping.ts:326-351`). Main's fix comment guarding empty re-extraction is for main's own step under serialization contexts, not a durable gap |
| #21319 suspension metadata cleanup | **PARALLEL** | durable clears approval/suspension metadata on resume (`tool-call.ts:743`); falsy-payload half already ported in Phase 1 (#22363) |
| #20487 declined-tools guard | **MOOT-ARCH** | main's bug was live `requireToolApproval` policy not surviving serialization; durable resume decisions read the serialized suspend payload by construction (C1) |
| #19486 assistant-msg mutation on resume | **MOOT-ADJUDICATED (L10)** | this is the #19445 seal-and-rotate mechanism; durable's per-iteration rotation covers it (predicate-hoist adjudication) |
| #20302 finish error, no payload | **MOOT-SHARED** | fix in `stream/aisdk/v5/transform.ts`; durable imports the same `execute` pipeline (`llm-execution.ts:34`) |
| #21449 actionable API errors | **PARALLEL** | durable exhaustion path preserves `lastError` structured (`llm-execution.ts:1903`); schedules half is out of loop scope |
| #20346 readOnly during suspension | **PARALLEL** | one-line `memoryConfig?.readOnly` save gate; durable readOnly family (#18856/#18921) covers its persistence path |
| #20347 concurrent workflow approvals | **MOOT-SHARED** | fix lives in `agent/thread-stream-runtime.ts`, imported by `durable-agent.ts` |
| #19375 persist processor data chunks | **PORTED** ✅ | durable's three producer-side writer sites (llm-execution `outputStepWriter`, tool-call processPart glue, tool-call `processToolResult` writer) emitted via pubsub but never persisted. Port: exported `persistProcessorDataChunk` from `stream/base/output.ts`; llm-execution persists directly into its messageList (serialized out via `messageListState`); tool-call sites collect into `processorDataParts` on the step output (its local messageList doesn't cross the boundary — O3 pattern) and llm-mapping commits them before serialize. No main double-persist: main's persistence stays consumer/driver-side; durable's is producer-side only. Consumer-side `processOutputStream` persistence remains architecturally void in durable (finalize-run overwrites the registry messageList) — covered by producer-side processing. Pinned by `durable-agent-processor-data-chunks.test.ts` (2 tests, fail on old code) |
| #18432 step providerMetadata | **MOOT** | durable already passes `providerMetadata: responseMetadata` to `runProcessOutputStep` (`llm-execution.ts:1663`) |
| #18542 makeCoreTool mastra/memory | **MOOT** | durable already passes `createMastraProxy` + `registryEntry.memory` (`llm-execution.ts:487-488`) |
| #16176 processLLMPrompt hook | **MOOT-PARALLEL** | earlier "zero references" finding was a grep-identifier error (`processLLMPrompt` is only the commit-message name; code uses `processLLMRequest`); durable wired it in #18712 (`llm-execution.ts:632-724`, rewritten prompt used at line 682) |
| #21724 modelSettings.timeout | **PORTED** (34e2001341) | per-call `timeout.stepMs` was already shared (read inside `stream/aisdk/v5/execute.ts`); run-level `totalMs` now armed on the registry entry's abort signal per session, persisted for cold resume, routed to the fatal error path |
| #22277 writer.custom on delegated resume | **DEFER-P2** | fix is in the main stream driver (L1 territory); verify durable's stream adapter during Phase 2 stream work |
| #19009 stopWhen∘maxSteps | **MOOT-ARCH** | durable evaluates `rt.maxSteps` independently of stopWhen (`durable-loop-builder.ts:533`, "maxSteps-only continuation"); replacement bug structurally impossible |
| #16873 exact hash matching | **OUT-OF-SCOPE** | agent-network loop; no durable counterpart |

## Tier 3 reverse checks (durable → main)

| Item | Verdict | Evidence |
|---|---|---|
| R1 readOnly flush guard | **ADOPTED** | main's background `onResult` flush glue (`tool-call-step.ts` `flush`) now gates on `memoryConfig?.readOnly`, matching durable's guard (durable `tool-call.ts:1219`). Suspension flush was already guarded (#20346); `SaveQueueManager.flushMessages` has no internal readOnly check, so the guard lives in engine glue on both sides. Pinning tests: `tool-call-step.test.ts` "background task result readOnly flush guard" |
| R2 #22437 server toModelOutput for client results | **MOOT** | commit `cedc25d8c2` touched shared `agent.ts` + main `tool-call-step.ts:1153` in the same change — both engines covered; appeared durable-only purely due to path filtering |
| R3 #21377 onOutput for client-executed results | **MOOT** | commit `33374ba359` touched shared `agent.ts` + main `prepare-stream/client-tool-output-hooks.ts` — same path-filter artifact |
| R4 #20404 nullish toModelOutput | **MOOT** | Commit N core handles it (`tool-result-commit-core.ts:49,77` — nullish result/mapping leaves key unset, result kept) |

## Final straggler list (proposed work, in order)

**Port to durable (confirmed):**
1. #17893 content-filter refusal terminal handling → durable llm-execution
   - ✅ PORTED. `TERMINAL_FINISH_REASONS` hoisted to `loop/shared/terminal-finish-reasons.ts`; durable's `isContinued` now excludes `error`/`length`/`content-filter` even when tool calls exist. Pinning test: `durable-agent-terminal-finish-reasons.test.ts`.
   - Pre-existing divergence noted (NOT part of this port): durable's formula also excludes `stop` from the pending-tool-call continuation (`toolCalls.length > 0 && !terminal`), whereas main deliberately continues when `stop` + tool calls arrive together (some models emit both). Whether durable's finish-reason normalization upstream makes this unreachable is unverified — deferred for separate review.
   - Related edge kept as-is: durable llm-mapping (line ~251) forces `isContinued=true` when a tool result carries an error, which can override a terminal reason. Main avoids the case differently (its #17893 change also gates `hasPendingToolCalls`, so tools never execute on a terminal reason). Narrow port keeps durable's tool-error recovery intact; flagged for the ledger if it ever bites.
2. ~~#22887 observe helpers in agent tools~~ — **RECLASSIFIED MOOT-SHARED** during port verification (see main-only table row); durable already gets `createToolObserve` via the shared builder fallback because it never forced `noopObserve`. No code change.
3. ~~#16176 processLLMPrompt provider-boundary hook~~ — **RECLASSIFIED MOOT-PARALLEL** during port verification; durable already runs `processLLMRequest` at its provider boundary (ported via #18712). Audit grepped the commit-message name (`processLLMPrompt`) instead of the code identifier (`processLLMRequest`). No code change.
4. ~~#22119 input-step re-extraction of last step's content~~ — **RECLASSIFIED MOOT-ARCH** during port verification; durable's step records are built AFTER llm-mapping commits tool results (loop-builder `.map`, not execution time), so `steps[last].toolResults` is already fresh for input-step processors, and durable never extracts step content from the messageList at all. No code change. Secondary note: durable's `steps` shape is `StepRecord` (`{text, toolCalls, toolResults, usage, finishReason}`) vs main's `DefaultStepResult` (with `content` array) — the `as any` cast at `llm-execution.ts:422` marks this. Processors reading `steps[i].toolResults` work on both; processors reading `steps[i].content` see undefined on durable. Pre-existing shape divergence, distinct from #22119 — ledger candidate.
5. #19375 data-chunk persistence → durable persist path — ✅ PORTED (99e861fd7b), see main-only table row.
6. #22128 resume-on-started-version pinning → durable — ✅ PORTED (6dfeb5a6a6), see main-only table row.
7. #14282 deferred provider-result patch → durable (coupled with O2's gate) — ✅ PORTED (0c4e9a2a68), see pre-fork straggler note above.
8. #21724 run-level `timeout.totalMs` budget → durable — ✅ PORTED (34e2001341). Budget composed into the registry entry's abort signal per execution session (stream/generate/resume/recovery — every durable step reads that signal, so the whole session is bounded); persisted on serialized `modelSettings` so cold resume re-arms the started budget; timer torn down via the entry's `cleanup` slot. Total timeouts route through the fatal error path (error chunk + reason 'error', no retry/fallback) in llm-execution, and the dowhile predicate lets a budget that expired between steps (mid-tool) reach that path instead of masking it as a clean abort. Deliberate divergence: durable emits step-finish/finish with reason 'error' (main emits no finish) because durable's finalization block owns stream closure.

**Main adopts:** R1 readOnly flush guard only — ✅ ADOPTED, see durable-only table row.

**Deferred to Phase 2:** #22277 (stream driver), #17727 (transport, Item 5), L18 processor-crash containment (already in PHASE2.md).

**Ledger additions:** step-lifecycle-chunk policy (#16687/#17370 vs #21529) — ✅ ADDED as ledger row L19 in PHASE3.md. Verification against current HEAD sharpened the audit's note: the processor-visibility behavior of #16687/#17370 is *inherited* by durable (consumer-side `MastraModelOutput` runs `processPart` on every chunk, no type filter); the deliberate divergence is producer-plane only — `onResult` injection (main, C2) vs direct pubsub emission from workflow steps (durable, C1), plus #21529's `emitStepEvents: false` suppressing workflow-engine step events for perf.

## Recommendation

The audit is done: 183 non-test divergent commits reduce to **6 durable ports + 1 main adoption + 1 ledger row** (#22887 and #16176 reclassified moot during port verification), everything else moot/engine-specific/parallel. Suggested order: #17893, #22119, #19375 (behavioral gaps, each a small commit with a pinning test), then #22128/#14282 (coupled resume-semantics work), then R1, then #21724 last. Each port is its own adjudication commit through the existing shared-core structure.

**Port-verification lesson (two reclassifications):** both #22887 and #16176 were misclassified as stragglers by grep-evidence errors — #22887 because *absence* of an `observe` override is what makes durable correct (main's bug was a forced `noopObserve`), #16176 because the grep used the commit-message name rather than the code identifier. Remaining ports should re-verify the gap against current HEAD before writing any code.
