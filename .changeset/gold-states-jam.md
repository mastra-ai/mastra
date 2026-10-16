---
'@mastra/core': patch
---

Fixed `sendSignal` with `ifActive: { behavior: 'discard' }` delivering the signal into a run on another instance. When another instance already holds the thread, the signal is now discarded and `accepted` resolves to `{ action: 'discard' }`, matching the same-instance behavior.
