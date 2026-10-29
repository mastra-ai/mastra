---
'@mastra/memory': patch
---

Fixed Observational Memory so `failurePolicy: 'continue'` keeps the agent turn running after any memory failure, not only Observer model errors. Degenerate Observer output, timeouts or aborts inside the Observer or Reflector call, and storage errors while saving or loading memory no longer end the turn. If memory can't be loaded, the turn runs without memory context and its messages are still saved. Cancelling the turn through its own `abortSignal` still stops it. Fixes #27263.
