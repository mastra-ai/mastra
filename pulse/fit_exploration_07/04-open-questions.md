# Open Questions

## Should Queue Enqueue Always Emit?

Current leaning: yes for queued Agent Signals that are not immediately model-visible.

Reason:

- queued signals alter context order.
- pending versus pre-run changes whether the signal becomes the first request or a later continuation.

Risk:

- emitting every enqueue and drain can be noisy for high-frequency signals.

Possible compromise:

- always emit drain/content Pulses.
- emit enqueue ChangePulses only when delivery and context-entry are separated by a run/iteration boundary.

## Should Queue Drain Use `surface: signal` Or `surface: context`?

Current leaning:

- `surface: signal` when describing the signal-specific drain behavior.
- `surface: context` when describing generic context reconstruction.

This may need one canonical form before a spec.

## Does Abort Need A Dedicated Surface?

Current leaning: yes, but call it `run_control` or `thread_control`, not `abort`.

Reason:

- abort is one control action among pause/resume/cancel/stop.
- surface should describe the domain, action should describe abort.

## Is Abort A ChangePulse?

Mixed:

- request/observed facts can be `ObservationPulse`.
- stored intent and final run state are `ChangePulse`.

Abort is not content and not a Relationship by itself.

## Should Expected Abort Produce Error Pulses?

No.

The source intentionally avoids error-level logging for expected AbortError under an aborted signal. Pulse should follow that distinction.

Unexpected provider errors that merely mention abort are still errors.

## How Much Remote Abort Transport Should Be Visible?

Only enough to explain distributed behavior.

Remote abort listener installation is likely plumbing. `run-abort-requested` and `abort_propagated` matter if a user needs to understand why a remote run stopped.

