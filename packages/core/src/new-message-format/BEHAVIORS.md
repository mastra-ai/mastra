# Action-native agent: behavior catalog

Source of truth for what the old-loop tests in `packages/core/legacy-tests.json` protected. Those files are
excluded from the default run (`LEGACY_TESTS=1` re-enables them) and are deleted with the old loop.

Each behavior gets one test, at the cheapest layer that proves it:
`unit` = pure converter test · `run` = `runAgent` + mock v7 model (offline) · `e2e` = live model.

Status: **covered** (has a new-path test) · **port** (in scope, needs a new-path test) ·
**later** (feature not on the new path yet) · **drop** (old-loop internals, no equivalent).

## Core loop

| Behavior | Legacy source | Layer | Status |
| --- | --- | --- | --- |
| Text streams as deltas, closes with a persisted `text` | text-streaming | unit + e2e | covered |
| Tool call → result → follow-up turn | multi-step-tool-loop, nested-tool-calls | e2e | covered |
| Parallel tool calls in one turn | multi-tool-parallel | run | port |
| Tool execution error stored as `tool-error`, run continues | tool-execution-errors | e2e | covered |
| Tool input streaming (`tool-input-*`) | tool-streaming | unit + e2e | covered |
| Provider error ends run with `error` + `run-end` | provider-error | run | covered |
| Abort before/during model and during tool execution | abort-signal, abort-during-tool-execution | run + e2e | port (tool case) |
| `maxSteps` / `stopWhen` stops long loops | max-steps-edge-cases, maxsteps-*, stop-condition-long-loop | run | port |
| Empty model turn ends cleanly | empty-turn | run | port |
| `toolChoice` / active tools respected | tool-choice, active-tools-enforcement | run | later |
| Provider metadata kept on reasoning/text | provider-metadata | unit | covered |
| Model retry / `Retry-After` / stream retry | model-retry-after, stream-error-retry | run | later |
| Dynamic instructions and model | dynamic-instructions, dynamic-model | run | port |
| Request context reaches tools, isolated per run | runtime-context, request-context-* | run | port |

## Approval and suspension

| Behavior | Legacy source | Layer | Status |
| --- | --- | --- | --- |
| Approve / decline round trip, resume from log | tool-approval, resume-after-decline, generate-approval-path | e2e + Studio | covered |
| Conditional `requireApproval` function | approval-conditional, approval-tool-level | run | port |
| Concurrent approvals in one turn | concurrent-approval | run | port |
| Tool runtime `suspend()` / resume | tool-runtime-suspension, auto-resume-suspended-tools, resume-stream | — | later |
| Client-side tools | client-tools | — | later |

## Memory

| Behavior | Legacy source | Layer | Status |
| --- | --- | --- | --- |
| History recall across runs, mixed input formats | memory-history, memory-multi-turn-persistence | e2e | covered |
| `lastMessages` window | memory-recall-window | run | port |
| Thread switch isolation | memory-thread-switch | run | port |
| Persist at each turn end | save-per-step, pending-tool-result-flush | run | port |
| Cross-turn ordering (ULID) | cross-turn-message-ordering, multi-call-thread-persistence | unit | covered |
| Working memory, semantic recall, OM | working-memory | — | later |

## Later features (not on the new path yet)

| Area | Legacy sources |
| --- | --- |
| Structured output | structured-output*, abort-structured-output, agent/__tests__/structured-output* |
| Processors (input/output/step/error/retry/guardrail) | input-*processor, output-*processor*, error-processor*, processor-retry, guardrail-tripwire, agent-processor |
| Lifecycle callbacks | on-finish, on-step-finish, on-error-callback, prepare-step, tool-lifecycle-hooks, iteration-complete |
| Sub-agents / delegation / agents & workflows as tools | agents-as-tools, delegation-*, include-subagent-tool-results, subagent-*, fs-routed-*, workflow-as-tool, agent-controller/subagent-tool, parallel-delegation-approval |
| Background tasks | background-task-*, background-tool-model-output |
| Signals / untilIdle / thread streams | signal-*, stream-until-idle, thread-stream-* |
| Goals / isTaskComplete | goal-*, is-task-complete-*, loop/workflows/agentic-execution/goal-step |
| Skills, workspace, toolsets, mode tools | skills-*, workspace, toolsets-override, agent-controller/mode-* |
| Attachments download recovery, schema compat validation | attachment-download-recovery, schema-compat-tool-validation |
| Observability / actor identity / FGA | observability-context, actor-identity, tracing-propagation, agent-fga |
| Agent controller (ask-user, suspension, session abort) | agent-controller/__tests__/* |

## Drop (old-loop internals)

Durable/evented engine parity and recovery (`agent/durable/**`), snapshot and workflow storage noise
(`suspended-snapshot-integrity`, `execution-workflow-storage-noise`), chunk shapes (`step-start-chunk-shape`),
eager dispatch internals (`eager-tool-dispatch-settled-work`), `mastra-distinctive`, `request-body-override`,
`tool-call-filter-resume`, `cyber-refusal-recovery`, `agent/utils`, `agent/__tests__/utils`.
Durable agents get their own catalog when they move to actions.
