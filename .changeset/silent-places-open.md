---
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added optional `feedbackId` and `reviewStatus` to `FeedbackInput` and `scoreId` to `ScoreInput` so callers can supply their own record ids and initial review status when adding feedback or scores.
