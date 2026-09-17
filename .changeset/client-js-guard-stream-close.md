---
'@mastra/client-js': patch
---

Cancelling the response body returned by `agent.stream()` (and `streamUntilIdle`, `resumeStream`, `approveToolCall`, `declineToolCall`) after the `finish` chunk no longer throws an uncaught `ERR_INVALID_STATE` error that could terminate the host process.
