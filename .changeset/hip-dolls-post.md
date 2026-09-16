---
'@mastra/factory': minor
---

Added an explicit `delivery` choice to Factory worker guidance.

Use `delivery: "send"` for immediate guidance or `delivery: "queue"` to wait for the worker’s current run to complete.
