---
'@mastra/client-js': patch
---

Fix an uncaught `ERR_INVALID_STATE` crash when a consumer cancels the response body returned by `agent.stream()` (and `streamUntilIdle`/`resumeStream`/`approveToolCall`/`declineToolCall`) after the `finish` chunk. `controller.close()` is now guarded on every path and `onFinish` errors are caught instead of escaping as unhandled rejections.
