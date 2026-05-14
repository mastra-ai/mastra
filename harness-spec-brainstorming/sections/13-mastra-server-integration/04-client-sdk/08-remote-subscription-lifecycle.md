### 13.4h Remote Subscription Lifecycle

**Remote subscription lifecycle.** The unsubscribe function returned by
`RemoteSession.subscribe(...)` is idempotent. It closes the active SSE request
for that subscription, stops SDK reconnect/token-refresh attempts for that
subscription, and suppresses later listener calls from in-flight transport work.
Reconnection, `Last-Event-ID` replay, `412` recovery, and scoped token refresh
are transport mechanics, not `HarnessEvent`s. If the SDK cannot open or recover
the per-session `/events` stream before the caller unsubscribes — for example
because of persistent network failure, unrecoverable auth/token failure, or a
session that is no longer readable to the principal — it reports a transport
subscription failure through an SDK-owned diagnostics/error surface outside
`RemoteSafeSession`. That transport failure does not settle pending operations;
those still recover through the snapshot and result-lookup composition above.

The SDK follows the §4.2 rule that run-level events, lifecycle events, display
state, and text chunks are not per-operation settlement boundaries.
