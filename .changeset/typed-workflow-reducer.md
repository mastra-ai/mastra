---
'@mastra/react': minor
---

`mapWorkflowStreamChunkToWatchResult` now takes a typed workflow stream event from `@mastra/core` instead of `{ type: string; payload: any }`, so TypeScript flags a chunk whose shape does not match a known workflow event.
