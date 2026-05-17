---
'@mastra/core': patch
'@mastra/libsql': patch
---

**Fixed** Harness v1 session deletion now uses guarded storage deletes for closed session trees, so atomic adapters can reject stale version or ownership guards before leaving associated records in an inconsistent state.

**Migration for custom Harness storage adapters:** adapter authors that extend `HarnessStorage` should implement `deleteSessions(opts: { sessions: DeleteSessionOptions[] }): Promise<void>` for correctness under concurrent or multi-session deletes. Adapters that override `deleteSessions` are treated as supporting atomic batch deletes by default; override `supportsAtomicDeleteSessions` to `false` only when an implementation is not all-or-nothing. The base class still delegates to `deleteSession` for compatibility, but that fallback is less safe under concurrency because it cannot make a sequence of `deleteSession` calls atomic. When a guard fails, implementations should reject without deleting any requested session and throw `HarnessStorageDeleteGuardConflictError` so callers can handle guarded delete conflicts consistently.
