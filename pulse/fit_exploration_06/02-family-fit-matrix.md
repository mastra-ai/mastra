# Family Fit Matrix

| Family | Source | Surface | Primitive Fit | Suggested Type | Suggested Action | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Signal normalization | `createSignal()` | signal | Skip | none | none | Validation/conversion only; no runtime consequence yet. | Skip |
| User message signal | `sendMessage()` / `queueMessage()` | content/signal | Pulse + Relationship | input / decision | accepted / delivery_decided | User-authored message should mostly look like content entering context; delivery decision explains immediate versus queued/wake behavior. | Apply |
| Reactive processor signal | `createProcessorSendSignal()` | signal/context | Pulse | input | accepted | Processor injects context into current run and optionally emits `data-signal`. Boundary or retry decision can be separate if meaningful. | Apply |
| Delivery decision | `sendSignal()` accepted result | signal | Pulse | decision | delivery_decided | `wake`, `deliver`, `persist`, `discard`, `blocked` are behaviorally distinct. | Apply |
| Active pending enqueue | `pendingSignalsByThread` | signal_queue | ChangePulse | state | enqueued | Queue state matters when signal is delivered during an active blocking run. | Apply selectively |
| Pre-run enqueue | `preRunSignalsByThread` | signal_queue | ChangePulse | state | enqueued | Means signal will be folded into the first model request of a reserved run. | Apply selectively |
| Signal drain | durable and non-durable drain paths | signal_queue/context | ChangePulse + Pulse | state / input | drained / accepted | Draining changes the next model input; content Pulse should remain the signal itself. | Apply |
| Persist-only signal | `ifActive/ifIdle.behavior: persist` | signal/context | Pulse + ChangePulse | decision / state | delivery_decided / persisted | May write signal to memory and broadcast persisted-signal stream without waking a normal run. | Apply |
| Discarded signal | delivery policy or transient persist | signal | Pulse | decision | delivery_decided | No content Pulse because body did not enter context/storage. | Apply selectively |
| Blocked signal | suspended/thread-blocked path | signal/suspension | Pulse | decision | delivery_blocked | Important for explaining why input did not wake/join execution. | Apply |
| State signal accepted | `applyStateSignal()` | signal/state | Pulse + ChangePulse | input / state | accepted / state_tracking_updated | Content enters context and thread metadata changes with version/cache key/active copies. | Apply |
| State signal skipped | `applyStateSignal()` | signal/state | Pulse | decision | state_signal_skipped | Duplicate unchanged input is intentionally suppressed. | Apply selectively |
| Notification signal | notification dispatcher | signal/notification | Pulse + ChangePulse | input / state | accepted / delivered | Signal content and inbox record lifecycle are distinct. | Apply |
| Notification summary signal | notification dispatcher | signal/notification | Pulse + ChangePulse | input / state | accepted / summary_emitted | One signal can summarize many records; use relationships. | Apply |
| Schedule-produced signal | schedules worker | schedule/signal | Pulse + Relationship | input / decision | fired / delivery_decided | Schedule firing may be its own Pulse if schedule behavior is in scope; signal mapping is ordinary `sendSignal()`. | Apply selectively |

