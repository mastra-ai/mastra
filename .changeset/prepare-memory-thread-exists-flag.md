---
'@mastra/core': patch
---

Fixed silent metadata loss for newly created threads. When an agent run created a brand new thread, any metadata a processor wrote to that thread mid-run via `updateThread` was wiped at end-of-run. The thread itself survived; only the metadata was lost.

The agent now correctly tracks that the thread is persisted after it is created, so the redundant end-of-run write that was overwriting metadata no longer happens. Affects both the AI SDK v5 streaming path and the legacy v4 generate path.

Fixes #16216.
