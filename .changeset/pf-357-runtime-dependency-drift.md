---
"@mastra/core": patch
"@mastra/server": patch
---

Improved Harness recovery safety by rejecting resumed or queued work when runtime dependencies changed after restart.
Added HTTP 409 (`harness.runtime_dependency_drifted`) responses for these drift conflicts on Harness routes.
