---
'@mastra/core': patch
---

Fixed streamed assistant messages carrying a different id than their persisted copy. Chat UIs that reconcile a live stream with refetched history could show the same assistant reply twice (for example after returning to a hidden tab); with a shared id, deduplication by message id now works for every turn, including text-only replies without tool calls.
