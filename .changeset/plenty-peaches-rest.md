---
'@mastra/ai-sdk': patch
---

Fixes propagation of custom data chunks from nested workflows in branches to the root stream when using `toAISdkV5Stream` with `{from: 'workflow'}`.

Previously, when a nested workflow within a branch used `writer.custom()` to write data-\* chunks, those chunks were wrapped in `workflow-step-output` events and not extracted, causing them to be dropped from the root stream.

**Changes:**

- Added handling for `workflow-step-output` chunks in `transformWorkflow()` to extract and propagate data-\* chunks
- When a `workflow-step-output` chunk contains a data-\* chunk in its `payload.output`, the transformer now extracts it and returns it directly to the root stream
- Added comprehensive test coverage for nested workflows with branches and custom data propagation

This ensures that custom data chunks written via `writer.custom()` in nested workflows (especially those within branches) are properly propagated to the root stream, allowing consumers to receive progress updates, metrics, and other custom data from nested workflow steps.
