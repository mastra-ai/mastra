---
"@mastra/observability": patch
---

Fix `model_chunk` event spans (e.g. `tool-result`) exporting `endedAt: null`. Event spans never get an `endTime`, so the Mastra platform and cloud exporters now fall back to `startTime` for event spans instead of writing `null`.
