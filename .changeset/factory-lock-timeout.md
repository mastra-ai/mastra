---
'@mastra/factory': patch
---

Bound the `withProjectLock` / `withDbAdvisoryLock` critical section with an `AbortSignal` timeout (default 60s, configurable via `timeoutMs`). Previously, an unbounded outbound call inside the lock could keep the transaction open for up to Neon's `idle_in_transaction_session_timeout` (5 minutes), pinning the pool connection and the advisory lock the entire time. On timeout the wrapper aborts the `fn`'s signal, rolls the transaction back, releases the connection, and throws `ProjectLockTimeoutError`.
