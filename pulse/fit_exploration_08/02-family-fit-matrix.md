# Family Fit Matrix

| Family | Source | Needed For Reconstruction | Suggested Pulse/Relationship | Required Fields | Verdict |
| --- | --- | --- | --- | --- | --- |
| Delivery decision | `sendSignal()` accepted result | Routing, outcome, target run/thread | `ObservationPulse(signal.delivery_decided)` | signal id, decision, target ids, active/idle behavior | Required |
| Pre-run enqueue | `preRunSignalsByThread` | Explain delivery before first request | `ChangePulse(signal_queue.enqueued)` | signal id, scope `pre-run`, run/thread id | Required when delayed |
| Pending enqueue | `pendingSignalsByThread` | Explain active-run follow-up latency | `ChangePulse(signal_queue.enqueued)` | signal id, scope `pending`, run/thread id | Required when delayed |
| Idle queue | `pendingIdleSignalsByThread` | Explain delayed wake after active owner clears | `ChangePulse(signal_queue.enqueued)` | signal id, scope `idle`, queued run id/thread id | Required if exporting idle handoff |
| Pre-run drain | first LLM request drain | Know first model input saw signal | `ObservationPulse(signal.drained_to_context)` | signal id, scope `pre-run`, model input/message id, order | Required |
| Pending drain | `signalDrainStep` | Know later model turn saw signal | `ObservationPulse(signal.drained_to_context)` | signal id, scope `pending`, model input/message id, forcedContinuation | Required |
| Response boundary | `markResponseMessageBoundary()` | Separate previous assistant response from new signal turn | relationship or attribute | previous response message id, boundary true | Required for exact replay |
| Message id rotation | drain steps | Bind signal to new model turn | attribute or relationship | old/new message id | Required for exact replay |
| Drain failure | failed stream during drain | Explain signal still queued | `ChangePulse(signal_queue.drain_failed)` | signal id, queue scope, reason | Required for distributed/debug replay |
| Lease handoff/forward | drain loses owner | Explain local queue removal/remote delivery | `ObservationPulse(signal.delivery_forwarded)` or relationship | signal id, old run id, winner run id | Required for distributed replay |
| Local pre-run copy discard | drained run loses lease | Prevent duplicate replay | `ChangePulse(signal_queue.local_copy_discarded)` | signal id, run id, reason | Required if local queues are exported |

