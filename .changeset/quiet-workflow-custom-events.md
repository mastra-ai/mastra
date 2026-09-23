---
'@mastra/react': patch
---

Fixed `useStreamWorkflow` crashing with `Cannot read properties of undefined (reading 'id')` when a workflow step emits a custom event through `writer.custom()`. Running, observing, resuming and time-travelling such workflows now keep updating step results, and custom events are skipped. Fixes [#17111](https://github.com/mastra-ai/mastra/issues/17111).
