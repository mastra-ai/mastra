---
'@mastra/core': minor
---

Harness v1: add four discrete accessors on `Session` for TUI / playground status surfaces.

- `Session.isBusy()` — broader than `isRunning()`. Returns true while a turn is in flight, the queue drain is active, a queued item is awaiting its turn, or a `respondTo*` suspension is pending. Use for "session is working at all" indicators; keep `isRunning()` for spinner / abort affordances tied to a single live turn.
- `Session.getQueueDepth()` — synchronous read of `pendingQueue.length`. The currently-draining item is tracked separately and not counted.
- `Session.getTokenUsage()` — fresh copy of the session's cumulative `{ promptTokens, completionTokens, totalTokens }` across completed turns. Not persisted across rehydration.
- `Session.waitForIdle({ timeoutMs? })` — resolves when `!isBusy()`. Rejects with `HarnessValidationError` on timeout or `HarnessSessionClosedError` if the session closes while waiting.
