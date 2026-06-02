---
'@mastra/react': patch
---

Fix workflow graph crash when observing a running workflow that emits non-step chunks (custom `writer.custom()` data chunks or agent stream chunks like `text-delta`). The stream reducer in `useStreamWorkflow` previously dereferenced `chunk.payload.id` for every chunk that wasn't `workflow-start` / `workflow-canceled` / `workflow-finish`, throwing `TypeError: Cannot read properties of undefined (reading 'id')` and breaking the workflow graph UI. The reducer now ignores chunks that aren't `workflow-step-*` or that lack `payload.id`.
