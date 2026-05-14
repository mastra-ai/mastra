### 13.6 Lifecycle and deployment

Mastra Server takes responsibility for `init` and `shutdown`. Consumers don't
call `harness.init()` directly when running under the server — `mastra.init()`
does it.

Server readiness waits for the Harness/channel registry and the required
durable-domain workers for each enabled ownership scope. A deployment should not
route provider callbacks to the process until all registered harnesses are
initialized, provider-owned callback bindings are durably loaded and validated
through `listProviderCallbackBindingsForHarness(...)` and
`loadProviderCallbackBindingBySelector(...)`, route ownership has been
validated,
legacy `AgentChannels` overlap checks have passed,
and the workers needed to make progress on newly accepted durable work for that
scope have initialized. Worker readiness is scoped to the durable domain, not to
the whole server: channel inbox/action processing, channel outbox projection
plus
dispatch, and `HarnessWakeupItem` processing are checked for the
`(harnessName, channelId?, source?)` ownership scopes they claim. A shared
operator worker may cover multiple scopes only when the registry records that
coverage and the worker still claims rows under the correct harness/channel
filters. One unavailable scope does not make unrelated harnesses, channels, or
read-only diagnostic routes unavailable.

Required worker readiness is a deployment and supervisor state, not proof that a
real backlog row was claimed during boot, and not a required public supervisor
API or health schema. A deployment may satisfy it with an in-process worker, a
managed supervisor, a protected operator loop, or another mechanism that proves
the same scope-local scan/claim/renew path. The worker or supervisor must have
validated current registry/provider/runtime configuration, reached the storage
backend with the due-row scan and claim/renew operations it will use, and
started
the polling or dispatch loop for the scope. If that check fails at boot, or if
the supervisor later becomes unhealthy, externally reachable durable ingress for
that scope returns HTTP 503 with `code: 'harness.worker_unavailable'`,
`retryable: true`, and the scope details in §13.3 before creating new inbox,
action, or wakeup rows. A route is not required to perform a duplicate-status
storage lookup before returning that 503. If it can answer a duplicate callback
solely from already durable proof without creating a row, claiming a row,
entering a session, or performing provider-visible work, it may return the
stored status instead; otherwise, the readiness gate remains the backpressure
path. Already durable proof includes terminal rows, inbox rows that are already
accepted or queued, action receipts that are already accepted or applied, and
retained source-specific duplicate or conflict proof. Any path that would create
a row, claim a row, enter a session, or perform provider-visible work is gated
by the same readiness check.
Read-only session reads and diagnostics are not blocked by an unrelated failed
worker scope, though they can still fail for their own auth, registry, or
storage errors. A synchronous route handler, pubsub subscription, or optional
operator dispatch route is not by itself recovery readiness unless due and
stale-claimed rows already persisted for the same scope are also being scanned
by an active worker, or new durable ingress for that scope is refused. If a
provider can only restore installation metadata asynchronously, that restore is
part of readiness for Harness-owned callbacks; otherwise the provider route
returns `503 harness.worker_unavailable` instead of guessing a target from the
payload.

The eviction policy (§5.4) applies normally. Sessions that haven't been touched
over their idle timeout are flushed and dropped from memory; subsequent SDK
calls hydrate them transparently from storage. Clients see no difference.

For zero-downtime deploys, the Mastra Server drains before `mastra.shutdown()`
runs. Drain has two parts that mirror the §13.6 readiness gate. First, the
server stops accepting new externally reachable Harness durable ingress for
the §13.1/§13.2 route set that creates, claims, or dispatches durable work:
channel inbound, channel action callbacks, session signal/queue/inbox writes,
attachment uploads, and wakeup-producing schedule/proactive handoffs. The
refusal contract mirrors readiness: the server returns `503
harness.worker_unavailable` with `retryable: true` and `reason:
'server_draining'` per §13.3, or the deployment stops accepting new
connections at the listener or load-balancer layer so they never reach the
instance. In either case callers retry against the next instance rather than
the draining one. Read-only session and diagnostic routes may keep answering
until `mastra.shutdown()` begins storage teardown. Second, already admitted
in-flight Harness turns, SSE consumers, and route handlers finish or time out
within a deployment-chosen bounded window before `mastra.shutdown()` runs.
Settled work persists state through the normal §5 storage path so the next
instance can pick it up; if the window expires before a turn finishes, the
server aborts the in-flight work, flushes dirty state, and releases the
session lease so the next instance can rehydrate cleanly. Sessions persist;
clients reconnect to the new server instance and resume. Shutdown emits at
most a best-effort harness-scoped `harness_shutdown` observer event for local
control planes; it does not emit `session_closed` for still-active session
records. Per-session SSE consumers should expect the connection or event
epoch to end and recover through the §10.5 replay/snapshot path.

Durable workers are drained the same way. Channel recovery workers stop
claiming new inbox, action, and outbox rows for their
`(harnessName, channelId)` ownership scope; `HarnessWakeupItem` processors
stop claiming new wakeup rows for their `(harnessName, channelId?, source?)`
ownership scope; and reconstructable background-task workers used as internal
machinery behind durable rows stop claiming new task rows for the scope they
own. Each worker may renew only the claims for work it is actively finishing,
then either commit terminal updates under the claim or let the claim TTL
expire for the next worker. Outbox projection before dispatch follows §14.4
using the §5.2 binding-discovery and outbox-claim methods; §13.6 only owns
the server lifecycle and drain boundary. Undelivered channel items remain in
`ChannelOutboxItem` storage, unadmitted ingress remains in `ChannelInboxItem`,
unapplied actions remain in `ChannelActionReceipt`, undue wakeups remain in
their `HarnessWakeupItem` ledger, and undelivered reconstructable tasks
remain behind their owning durable row; the next server/worker instance
retries them.

Background-task workers follow the same split between durable contract and
executor. They may be used as internal workers only when restart can rebuild
their executor and completion path from persisted metadata, or when an owning
inbox/action/outbox/wakeup row remains retryable if the task cannot be rebuilt.
A deployment that removes a referenced executor or completion policy must fail
closed for that work or surface the owning durable row for operator repair; it
must not rely on a raw background task row as the only recovery handle for
external integrations. Raw closure-backed background-task work whose executor is
not reconstructable and whose owning Harness durable row would not retry it on
restart is not part of the drain contract: its in-process work may be cancelled
at shutdown, and recovery is the owning row's responsibility on the next
instance.

Background-task manager readiness satisfies this deployment rule only for
reconstructable task scopes whose storage supports scan, claim, renew, and
claim-guarded terminal updates, and whose executor/completion policy can be
validated against current runtime config. Raw background task rows are not
promoted into the channel or wakeup claim contract by server readiness. A
manager that can only list tasks and blind-update `running` / terminal status is
not readiness for restart-safe work.
