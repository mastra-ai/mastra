---
'@mastra/core': patch
---

A run whose thread lease ran out only because its process fell behind (a renewal sent late under heavy load, or none confirmed before the lease's deadline) now takes the lease back and keeps going, instead of being aborted. It is still aborted when another run holds the thread, or when the lease backend can't be reached.

When a run is aborted because another run holds its thread lease, the `abort` chunk subscribers receive now carries `payload.reason: 'thread-lease-lost'`, and a session's `agent_end` event carries `abortReason: 'thread-lease-lost'`, so hosts can show why the run stopped.
