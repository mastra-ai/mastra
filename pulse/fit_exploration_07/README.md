# Signal Queue Drain And Abort Fit Exploration

This exploration follows `fit_exploration_06/`.

It tests two items that were intentionally left under-explored:

1. whether Agent Signal queue/drain needs explicit Pulse coverage for model-input reconstruction
2. how non-Agent-Signal abort/cancellation should map into Pulse

## Boundary

In scope:

- active-run pending signal queues
- pre-run signal queues
- pending idle signal handoff
- non-durable and durable signal drain steps
- abort requested for run/thread streams
- upstream `AbortSignal` propagation
- abort observed by model/tool/workflow execution
- abort completion/finalization facts

Out of scope:

- generic browser/DOM `AbortSignal` API semantics
- every call site that forwards `abortSignal`
- UI-only abort button telemetry
- reference docs
- implementation changes

## Inputs

Read:

- `pulse/fit_exploration_06/05-learnings-summary.md`
- `pulse/fit_exploration_06/07-decision-record.md`
- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`
- `packages/core/src/agent/durable/workflows/steps/signal-drain.ts`
- `packages/core/src/agent/durable/workflows/steps/llm-execution.ts`
- `packages/core/src/agent/durable/abort-transport.ts`
- `packages/core/src/agent/durable/types.ts`

## Main Questions

- Is `signal.delivery_decided: deliver` enough to reconstruct when the model saw a signal?
- Should pre-run and pending signal drains emit different Pulse shapes?
- Is abort a Signal, ChangePulse, Relationship, or something else?
- Which abort facts matter: requested, propagated, observed, completed, or all of them?

