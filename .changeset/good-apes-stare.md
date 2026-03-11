---
'@mastra/daytona': patch
---

Fixed sandbox reconnection when Daytona sandbox is externally stopped or times out due to inactivity. Previously, the error thrown by the Daytona SDK (e.g. "failed to resolve container IP") did not match the known dead-sandbox patterns, so the automatic retry logic would not trigger and the error would propagate to the user. Added two new error patterns to correctly detect stopped sandboxes and trigger automatic recovery.
