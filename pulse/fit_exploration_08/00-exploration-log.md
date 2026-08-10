# Exploration Log

## 2026-08-10 - Source And Test Review

Read:

- `fit_exploration_07/05-learnings-summary.md`
- `fit_exploration_07/07-decision-record.md`
- durable signal drain tests
- agent signal runtime tests around failed drain, lease handoff, and pre-run copies
- `MessageList.addSignal()`
- `MessageList.markResponseMessageBoundary()`
- `MessageList.generateCreatedAt()`
- non-durable and durable signal drain code

Findings:

- `delivery_decided: deliver` can mean "queued into an active run", "queued before first request", "forwarded to a lease owner", or "attached to a continuation reservation".
- pre-run drain happens before the first model request and folds signals into that request.
- pending drain happens after an iteration, marks response boundary, rotates message id, and forces continuation.
- durable tests assert pending signals force at least a second model call even when the model would have stopped.
- failed signal drain can leave a signal queued while a continuation takes over the lease.
- a drained run can lose its reserved lease, discard local pre-run copies, and forward to the winner.
- `MessageList.addSignal()` rewrites signal `createdAt` to context-entry order and stores the original accepted/created timing in signal metadata.
- MessageList sorts messages by `createdAt`; timestamps are generated at least 1ms apart for ordered additions.
- `markResponseMessageBoundary()` marks the prior assistant message so later signal input does not merge into the wrong response context.

Risk noticed:

- If Pulse only records delivery, replay can put the signal too early.
- If Pulse only records queue and not drain, replay can know the signal was pending but not which model input consumed it.
- If Pulse records only drain without queue, replay can reconstruct model input but cannot explain delivery latency or dropped/failed handoffs.

## 2026-08-10 - Reconstruction Boundary

Hypothesis:

- the Pulse content owner for delayed signals should be the model-visibility/drain Pulse, not the delivery Pulse.

Reason:

- delivery is routing/control.
- context-entry is when `MessageList.addSignal()` assigns transcript ordering.
- model input reconstruction needs the context-entry order, response boundary, and model-turn identity.

Consequence:

- `signal.delivery_decided` may reference a signal id and delivery outcome but should not own content by default.
- `signal_queue.enqueued` preserves delayed intent.
- `signal.drained_to_context` owns content and binds it to a model input turn.

