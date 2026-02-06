# Dataset Run Executor — Architecture

## High-Level Flow

The main `runDataset` function orchestrates the entire run lifecycle: loading the dataset, resolving the target and scorers, then processing each item concurrently via `p-map`. Each item goes through an optional retry loop, scoring, and storage persistence before contributing to the final `RunSummary`. Abort and errors produce a partial summary instead of throwing.

```mermaid
flowchart TD
    START([runDataset called]) --> PARSE[Parse RunConfig]
    PARSE --> STORAGE[Get storage stores<br/>datasetsStore + runsStore]
    STORAGE --> LOAD_DS[Load dataset + items<br/>by version]
    LOAD_DS --> RESOLVE_T[Resolve target<br/>agent / workflow / scorer]
    RESOLVE_T --> RESOLVE_S[Resolve scorers<br/>instances + string IDs]
    RESOLVE_S --> CREATE_RUN[Create / update run record<br/>status → running]
    CREATE_RUN --> PMAP

    subgraph PMAP ["p-map  (maxConcurrency items in parallel)"]
        direction TB
        CHECK_ABORT{signal<br/>aborted?}
        CHECK_ABORT -- Yes --> THROW_ABORT[throw AbortError]
        CHECK_ABORT -- No --> COMPOSE_SIG[Compose per-item signal<br/>itemTimeout + run signal]
        COMPOSE_SIG --> EXEC_TARGET

        subgraph RETRY_LOOP ["Retry loop (up to maxRetries)"]
            EXEC_TARGET[executeTarget] --> RESULT_CHECK{error<br/>returned?}
            RESULT_CHECK -- No error --> EXIT_RETRY[break]
            RESULT_CHECK -- Error --> TRANSIENT{isTransient<br/>Error?}
            TRANSIENT -- No --> EXIT_RETRY
            TRANSIENT -- Yes --> BACKOFF["wait: retryDelay × 2^attempt + jitter"]
            BACKOFF --> RECHECK_ABORT{signal<br/>aborted?}
            RECHECK_ABORT -- Yes --> EXIT_RETRY
            RECHECK_ABORT -- No --> EXEC_TARGET
        end

        EXIT_RETRY --> COUNT{error?}
        COUNT -- Yes --> FAIL_INC[failedCount++]
        COUNT -- No --> SUCC_INC[succeededCount++]
        FAIL_INC --> BUILD_ITEM[Build ItemResult]
        SUCC_INC --> BUILD_ITEM
        BUILD_ITEM --> RUN_SCORERS[runScorersForItem]
        RUN_SCORERS --> PERSIST_RESULT[Persist to runsStore.addResult<br/>try/catch — non-fatal]
        PERSIST_RESULT --> RETAIN{retainResults?}
        RETAIN -- Yes --> STORE_MEM["results[index] = item + scores"]
        RETAIN -- No --> SKIP_MEM[skip]
    end

    THROW_ABORT --> CATCH_BLOCK
    PMAP -- all items done --> FINALIZE
    PMAP -- fatal error / abort --> CATCH_BLOCK

    subgraph CATCH_BLOCK [Abort / Error Path]
        UPDATE_FAILED[Update run → failed]
        UPDATE_FAILED --> CALC_SKIP_F[skippedCount = total − succeeded − failed]
        CALC_SKIP_F --> RETURN_PARTIAL["Return RunSummary<br/>status: failed<br/>partial results"]
    end

    subgraph FINALIZE [Normal Completion]
        CALC_STATUS{"failedCount<br/>== totalItems?"}
        CALC_STATUS -- Yes --> STATUS_F[status: failed]
        CALC_STATUS -- No --> STATUS_C[status: completed]
        STATUS_F --> UPDATE_RUN[Update run in storage]
        STATUS_C --> UPDATE_RUN
        UPDATE_RUN --> CALC_SKIP_N[skippedCount = total − succeeded − failed]
        CALC_SKIP_N --> CALC_CWE["completedWithErrors =<br/>completed && failedCount > 0"]
        CALC_CWE --> RETURN_SUMMARY["Return RunSummary<br/>results in original order"]
    end
```

## executeTarget Dispatch

Routes a single dataset item to the correct executor (agent, workflow, or scorer). Handles the `raceWithSignal` guard that ensures per-item timeouts are enforced even when the target ignores the abort signal. All errors are caught and returned as `{ output: null, error }` — this function never throws.

```mermaid
flowchart TD
    ET([executeTarget]) --> SIG_CHECK{signal<br/>aborted?}
    SIG_CHECK -- Yes --> THROW[throw AbortError]
    SIG_CHECK -- No --> SWITCH{targetType}

    SWITCH -- agent --> AGENT[executeAgent]
    SWITCH -- workflow --> WF[executeWorkflow]
    SWITCH -- scorer --> SC[executeScorer]
    SWITCH -- processor --> ERR[throw not supported]

    AGENT --> RACE{signal<br/>provided?}
    WF --> RACE
    SC --> RACE

    RACE -- Yes --> RACE_SIG["raceWithSignal(promise, signal)<br/>ensures timeout even if<br/>target ignores signal"]
    RACE -- No --> AWAIT[await promise]

    RACE_SIG --> RESULT[ExecutionResult]
    AWAIT --> RESULT

    THROW --> CATCH[catch → ExecutionResult<br/>output: null, error: message]
    RESULT --> OUT([return])
    CATCH --> OUT

    subgraph AGENT_DETAIL [executeAgent]
        direction TB
        GET_MODEL[agent.getModel]
        GET_MODEL --> MODEL_CHECK{isSupportedLanguageModel?}
        MODEL_CHECK -- Yes --> GEN["agent.generate(input, {<br/>  scorers: {},<br/>  returnScorerData: true,<br/>  abortSignal: signal<br/>})"]
        MODEL_CHECK -- No --> LEGACY["agent.generateLegacy?(input, ...)"]
        LEGACY --> NULL_CHECK{result == null?}
        NULL_CHECK -- Yes --> THROW_LEGACY[throw: no generateLegacy]
        NULL_CHECK -- No --> EXTRACT
        GEN --> EXTRACT[Extract traceId + scoringData]
    end

    subgraph WF_DETAIL [executeWorkflow]
        direction TB
        CREATE_RUN_WF["workflow.createRun({ disableScorers })"]
        CREATE_RUN_WF --> START["run.start({ inputData })"]
        START --> WF_STATUS{status}
        WF_STATUS -- success --> WF_OK[output: result.result]
        WF_STATUS -- failed --> WF_FAIL[error: message]
        WF_STATUS -- tripwire --> WF_TRIP[error: tripwire reason]
        WF_STATUS -- suspended --> WF_SUSP[error: not supported]
        WF_STATUS -- paused --> WF_PAUSE[error: not supported]
    end

    subgraph SC_DETAIL [executeScorer]
        direction TB
        SC_RUN["scorer.run(item.input)"]
        SC_RUN --> SC_VALIDATE{score is number<br/>and !NaN?}
        SC_VALIDATE -- Yes --> SC_OK["output: { score, reason }"]
        SC_VALIDATE -- No --> SC_WARN["warn + score: null"]
    end
```

## Scorer Pipeline

After each item is executed, its output is scored by all configured scorers **in parallel** via `Promise.allSettled`. Each scorer runs in isolation — one scorer failing doesn't affect the others. Score persistence to storage is best-effort (errors are warned, not thrown).

```mermaid
flowchart TD
    START([runScorersForItem]) --> EMPTY{scorers<br/>empty?}
    EMPTY -- Yes --> RETURN_EMPTY["return []"]
    EMPTY -- No --> PARALLEL

    subgraph PARALLEL ["Promise.allSettled (all scorers in parallel)"]
        direction TB
        S1["scorer₁"] --> SAFE1[runScorerSafe]
        S2["scorer₂"] --> SAFE2[runScorerSafe]
        SN["scorer_n"] --> SAFEN[runScorerSafe]

        SAFE1 --> PERSIST1["validateAndSaveScore<br/>try/catch — best effort"]
        SAFE2 --> PERSIST2["validateAndSaveScore<br/>try/catch — best effort"]
        SAFEN --> PERSISTN["validateAndSaveScore<br/>try/catch — best effort"]
    end

    PARALLEL --> MAP_SETTLED["Map settled results:<br/>fulfilled → value<br/>rejected → { score: null, error }"]
    MAP_SETTLED --> RETURN(["ScorerResult[]"])

    subgraph SAFE ["runScorerSafe (per scorer)"]
        direction TB
        RUN["scorer.run({<br/>  input: scorerInput ?? item.input,<br/>  output: scorerOutput ?? output,<br/>  groundTruth: item.expectedOutput<br/>})"]
        RUN --> EXTRACT_SCORE[Extract score + reason]
        EXTRACT_SCORE --> VALIDATE{score is number?}
        VALIDATE -- Yes --> OK[ScorerResult with score]
        VALIDATE -- No --> NULL_SCORE[score: null]
        RUN -- catch --> ERR_RESULT["ScorerResult<br/>score: null, error: message"]
    end
```

## Signal & Timeout Composition

Shows how the run-level `AbortSignal` and per-item `itemTimeout` are composed into a single signal per item. Uses `AbortSignal.timeout()` and `AbortSignal.any()` (Node ≥22.13). The composed signal is passed to `executeTarget` and ultimately to `agent.generate()` via `abortSignal`. Note: `workflow.start()` does not accept a signal — timeout is enforced externally via `raceWithSignal`.

```mermaid
flowchart LR
    subgraph CONFIG [RunConfig]
        RUN_SIGNAL["signal<br/>(run-level AbortSignal)"]
        TIMEOUT["itemTimeout<br/>(milliseconds)"]
    end

    TIMEOUT --> TIMEOUT_SIG["AbortSignal.timeout(itemTimeout)"]

    RUN_SIGNAL --> ANY{"both<br/>present?"}
    TIMEOUT_SIG --> ANY

    ANY -- Yes --> COMBINED["AbortSignal.any([signal, timeoutSignal])"]
    ANY -- "signal only" --> PASS_SIG[use signal as-is]
    ANY -- "timeout only" --> PASS_TIMEOUT[use timeoutSignal]
    ANY -- neither --> NO_SIG[undefined]

    COMBINED --> ITEM_SIG[itemSignal]
    PASS_SIG --> ITEM_SIG
    PASS_TIMEOUT --> ITEM_SIG
    NO_SIG --> ITEM_SIG

    ITEM_SIG --> ET["executeTarget(target, type, item, { signal: itemSignal })"]
    ET --> RACE["raceWithSignal(promise, itemSignal)<br/>rejects on abort/timeout"]
```

## Data Flow

End-to-end data shape from dataset input to `RunSummary` output. Each item flows through execution → scoring → dual persistence (storage + in-memory). The `retainResults` flag controls whether results accumulate in memory or are only persisted to storage, allowing large runs to avoid heap pressure.

```mermaid
flowchart LR
    subgraph INPUT
        DS[(Dataset)]
        ITEMS["DatasetItem[]<br/>{ id, input, expectedOutput, version }"]
    end

    DS --> ITEMS
    ITEMS --> PMAP["p-map<br/>(concurrent)"]

    PMAP --> EXEC["executeTarget<br/>→ ExecutionResult<br/>{ output, error, traceId,<br/>scorerInput, scorerOutput }"]
    EXEC --> SCORERS["runScorersForItem<br/>→ ScorerResult[]<br/>{ scorerId, score, reason, error }"]

    SCORERS --> ITEM_RESULT["ItemWithScores<br/>= ItemResult + scores"]

    ITEM_RESULT --> STORAGE_PATH["runsStore.addResult()<br/>(best-effort persist)"]
    ITEM_RESULT --> MEM_PATH{"retainResults?"}
    MEM_PATH -- true --> RESULTS["results[index]<br/>(ordered array)"]
    MEM_PATH -- false --> DISCARD["discarded<br/>(use storage)"]

    RESULTS --> SUMMARY
    DISCARD --> SUMMARY

    subgraph SUMMARY [RunSummary]
        direction TB
        S_FIELDS["runId, status, totalItems<br/>succeededCount, failedCount<br/>skippedCount, completedWithErrors<br/>startedAt, completedAt<br/>results: ItemWithScores[]"]
    end
```
