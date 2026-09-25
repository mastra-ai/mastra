---
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Changed `addFeedback()` and `addScore()` to emit the event with the provided `traceId` and `spanId` when the trace cannot be found in observability storage, instead of dropping it. Feedback and scores without a `traceId` are now emitted unanchored. Caller-supplied `feedbackId`, `scoreId`, and `reviewStatus` are kept on the emitted event. The storage lookup is skipped entirely when no observability storage is configured, so remote-only exporter setups no longer wait through the retry schedule.
