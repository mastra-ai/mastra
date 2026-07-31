---
"@mastra/core": patch
---

Fixed a bug where disconnecting one consumer of a workflow's `fullStream` (or a model's evented stream) would silently stop every other concurrent consumer of the same run from receiving further chunks. This affected cases like two `/stream` requests for the same `runId`, or `/stream` combined with `/observe` — one client disconnecting no longer breaks the others, which now keep receiving chunks and close normally.
