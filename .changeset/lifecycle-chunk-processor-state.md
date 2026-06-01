---
'@mastra/core': patch
---

Fixed output processor state continuity for step lifecycle chunks during streaming. Lifecycle chunks (e.g. `step-finish`) routed through the stream `outputWriter` now share the same per-processor state map as the main model-output path, so state set in `processOutputStream` while handling content chunks is visible when the lifecycle chunk is processed (and in `processOutputResult`). Previously these chunks were handled with an isolated, empty state.

Note: as part of routing lifecycle chunks through output processors, an aborted stream now surfaces content the model produced before the abort (e.g. a `text-start` chunk and partial `text`) instead of dropping it. Consumers that assumed an aborted result always had empty text may now observe partial output.
