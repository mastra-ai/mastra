# Family Fit Matrix

| Family | Source | Surface | Primitive Fit | Suggested Type | Suggested Action | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active-run signal enqueue | `pendingSignalsByThread` | signal_queue | ChangePulse | state | enqueued | Signal will become a later model turn, not immediate input. | Apply |
| Pre-run signal enqueue | `preRunSignalsByThread` | signal_queue | ChangePulse | state | enqueued | Signal will be folded into first model request. | Apply |
| Pending idle enqueue | `pendingIdleSignalsByThread` | signal_queue/thread | ChangePulse | state | idle_wake_queued | Starts after active owner clears thread reservation. | Apply selectively |
| Pre-run drain | LLM execution before first request | context/signal_queue | ObservationPulse + ChangePulse | input/state | drained_to_context | Content enters first model request. | Apply |
| Pending drain | `signalDrainStep` | context/signal_queue | ObservationPulse + ChangePulse | input/state | drained_to_context | Forces continuation and new model turn. | Apply |
| Durable signal drain | durable signal drain step | context/signal_queue | ObservationPulse + ChangePulse | input/state | drained_to_context | Same semantics as non-durable; best-effort failure leaves signals queued. | Apply |
| Drain lease handoff | `#drainPendingSignals` | thread_control | ObservationPulse | decision | lease_handoff_decided | Matters only for distributed correctness/debugging. | Apply selectively |
| Upstream abort wired | `prepareRunOptions()` | run_control | Skip or ChangePulse | state | abort_listener_attached | Plumbing only unless debugging cancellation setup. | Skip by default |
| Run abort requested | `abortRun()` / `abortThread()` | run_control/thread_control | ObservationPulse | decision | abort_requested | User/system control fact. | Apply |
| Remote abort requested | `run-abort-requested` pubsub | thread_control | ObservationPulse | decision | abort_requested | Cross-process control message, not content. | Apply |
| Abort intent stored | `abortedRunIds` | run_control | ChangePulse | state | abort_intent_recorded | Needed when run not prepared yet. | Apply |
| Model abort observed | LLM execution stream loop | execution/model | ObservationPulse | state | abort_observed | Execution changes behavior and stops accumulating chunks. | Apply |
| Tool abort observed | tool-call step | execution/tool | ObservationPulse | state | abort_observed | Tool call left incomplete instead of faked success/error. | Apply |
| Abort completed | `run-aborted`, final reason `abort` | run_control | ChangePulse | state | abort_completed | Final run state changed to canceled/aborted. | Apply |

