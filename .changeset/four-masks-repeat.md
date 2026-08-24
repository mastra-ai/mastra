---
'@mastra/core': patch
---

Fixed slow streaming when a workflow is used as an output processor. The workflow runs once per streamed chunk, and each of those runs was saved to storage with the whole response so far, so a long reply got quadratically slower and heavier the more it streamed. Those per-chunk runs are now transient: they no longer write workflow snapshots or emit public traces, while the processor logic and tripwire behavior are unchanged. Running the same workflow directly still persists and traces as before. Fixes #19605.
