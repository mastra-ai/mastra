---
'@mastra/core': patch
---

Fixed two thread ownership bugs in durable agents running across multiple instances:

- A replayed `run-registered` event from a finished run no longer takes over as the thread's active run, even if its record is still cached locally.
- `sendSignal` now recognizes an active run owned by another instance while the thread is observed, so `ifActive` behavior (for example `discard`) applies instead of waking a new run.
