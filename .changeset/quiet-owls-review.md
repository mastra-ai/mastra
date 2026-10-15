---
'@mastra/react': patch
---

Review items returned by `useReviewItems` and `useCompletedItems` now include `targetType`, `startedAt` and `completedAt` from the experiment result, so a review item can be rendered exactly like the same result on its experiment page (agent answer as text, run duration).
