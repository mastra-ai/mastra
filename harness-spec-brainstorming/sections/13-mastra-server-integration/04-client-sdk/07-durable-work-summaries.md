### 13.4g Durable Work Summaries

**Durable work summaries.** `RemoteSession` and first-party controllers consume
`SessionListItem.durableWork` and `SessionSnapshot.durableWork` as bounded
status projections for "is this session still doing recoverable work?" after a
reload, restart, or replay gap. The SDK treats these rows as UI/read-model state
only: they can show queue retry, wakeup claim, accepted inbox response, channel
outbox delivery, or qualified background-task execution status, but they do not
settle `message(...)` / `queue(...)` promises, do not replace result lookup, and
do not expose raw channel/task ledgers. `sourceDurability: 'best-effort'` or
`'live-only'` is advisory; only the referenced source-specific durable row or
result boundary owns recovery.

The SDK never puts the main bearer/API token in an SSE URL. It uses
header-capable fetch streaming or deployment-secure cookies for authenticated
streams when available. If an implementation must use browser-native
`EventSource`, the SDK first obtains a scoped event subscription token through a
normal authenticated request and uses it only for the per-session `/events`
connection. A `401` or equivalent auth failure on that stream causes the SDK to
refresh/reacquire the scoped token through the normal auth path and reconnect
with the last seen `Last-Event-ID`; event gaps still recover through the
snapshot/result-lookup flow above.
