---
'@mastra/core': minor
---

Added an opt-in `persistPartialOnAbort` stream option that saves the assistant text streamed before a cancellation. Only the pre-abort snapshot is persisted, so output a provider keeps producing after cancellation is discarded, and nothing is saved when no text was streamed. Aborted streams still persist nothing by default. Also fixed thread creation tracking so a thread created during step persistence is no longer re-created on finish. Fixes #17510.
