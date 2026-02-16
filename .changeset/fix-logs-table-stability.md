---
'@mastra/playground-ui': patch
---

Added client-side deduplication by `runId` in `useWorkflowRuns` to prevent duplicate rows when offset pagination returns overlapping results across refetch cycles. Removed `gcTime: 0` and `staleTime: 0`. Fixed missing `fetchNextPage` in `useEffect` dependency array.
