---
'@mastra/core': patch
---

Fix assistant text parts being reordered when merging multiple text parts after tool results. Account for synthetic step-start markers without moving later tool results across text, preserving the order used for stored messages and model history.
