# Signal Visibility Reconstruction Exploration

This exploration focuses on a key outcome from `fit_exploration_07/`:

> `signal.delivery_decided: deliver` is not enough to reconstruct when the model saw the signal.

The goal is to determine what facts Pulse must export to rebuild model input sequence from signal delivery, queues, drains, message boundaries, and MessageList ordering behavior.

## Boundary

In scope:

- delivered Agent Signals that are not immediately model-visible
- pre-run signal drain
- pending/inter-iteration signal drain
- failed drain and lease-handoff behavior
- MessageList signal timestamp rewriting
- response boundaries and message id rotation
- minimal facts needed to reconstruct model input arrays

Out of scope:

- abort/cancellation, except where tests overlap
- notification semantics beyond signal visibility
- implementation changes
- old exploration rewrites

## Inputs

Read:

- `pulse/fit_exploration_07/05-learnings-summary.md`
- `pulse/fit_exploration_07/07-decision-record.md`
- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`
- `packages/core/src/agent/durable/workflows/steps/llm-execution.ts`
- `packages/core/src/agent/durable/workflows/steps/signal-drain.ts`
- `packages/core/src/agent/durable/__tests__/durable-agent-signal-drain.test.ts`
- `packages/core/src/agent/__tests__/agent-signals.test.ts`
- `packages/core/src/agent/message-list/message-list.ts`

## Main Question

What is the smallest append-only Pulse/Relationship set that can reconstruct:

- which signal was delivered
- whether it was immediately visible or queued
- which model input turn eventually included it
- whether it was folded into the first request or forced a later continuation
- where it belongs relative to assistant response boundaries and other context items

