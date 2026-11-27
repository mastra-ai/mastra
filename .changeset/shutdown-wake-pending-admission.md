---
'@mastra/core': patch
---

Mastra.shutdown() now waits for the thread runs it owns to finish being admitted before it hands them back. Waking an idle thread with `sendSignal({ ifIdle: { behavior: 'wake' } })` acquires the thread lease and registers the run asynchronously; shutting down at that moment used to snapshot the thread before the run existed, so the run started afterwards and kept ticking while shutdown reported success. Pending admissions are now tagged with the Mastra instance that owns them, and shutdown awaits only those (bounded by the existing abort grace) before stopping and releasing leases. Runs owned by another Mastra instance are never waited on, and a rejected or never-settling admission cannot make shutdown hang or reject.
