### 5.7d Durability Boundary

**Durability boundary.** The harness owns durability for `queue` items
pre-acceptance. The agent layer owns durability for everything signal-driven
post-acceptance (every `message(...)` and every drained `queue(...)`). The
boundary is the `signal.accepted` resolution from the required agent
`sendSignal(...)` contract in §4.2.

Accepted signal durability includes per-signal terminal result correlation. For
`message(...)`, the accepted `signalId` must eventually map to
`message_completed` or `message_failed` and to the message-result lookup route.
The terminal result is scoped to that signal. If recovery can no longer prove a
completed answer because the run was interrupted, the session was closed, the
runtime surface drifted, or retained signal evidence expired, the lookup/event
path reports a terminal outcome for that `signalId` rather than an open-ended
`pending`: `message_failed` / `queue_failed` while evidence is retained, or
`expired` from a lookup route when full evidence has compacted but an
`OperationAdmissionTombstone` still identifies the operation. For drained
`queue(...)` items, the `QueueAdmissionReceipt` binds
`queuedItemId` to the accepted `signalId` and terminal result/error. Run-level
`agent_end` and lifecycle events are only display/inspection signals; they do
not prove which admitted operation has settled.

If a session owner terminalizes an unresolved accepted signal because of lost
runtime dependencies, unrecoverable interruption, or result evidence expiry, or
if the §5.5 close/delete owner terminalizes it during lifecycle cleanup, that
owner writes the same retained operation-result/tombstone evidence used by
`getSignalResult(...)` projections. It must not call `sendSignal(...)` again for
that operation, and it must not infer a signal's outcome from run-level
lifecycle events. When those terminal outcomes are surfaced as retained
`OperationEvent`s, their observer ordering follows §10.4.

For channel ingress there is one extra pre-acceptance boundary: the bridge owns
durability from provider webhook receipt through `ChannelInboxItem` admission.
Subject to the §13.6 worker-readiness gate, external webhook ACKs are sent only
after the inbox item is durably recorded; final Harness run/queue metadata may
arrive later and duplicate webhook retries report the current inbox status
according to the §13.6 readiness and duplicate-status rules. Once the
corresponding `session.message(...)` signal is accepted, the normal agent-layer
durability boundary applies. For channel outbound, durability is owned by
deterministic `ChannelOutboxItem` projection until the adapter records a
successful provider delivery. For channel actions, token/projection durability
is owned by `ChannelActionToken`, first-response/application durability is owned
by `ChannelActionReceipt`, and resume idempotency is owned by the persisted
two-phase `InboxResponseReceipt`.
