---
"@mastra/server": patch
---

Fixed `/stream`, `/resume-stream`, and `/time-travel-stream` writing duplicate chunks to the workflow run cache when two clients streamed the same run at the same time. The history replayed by `POST /workflows/:workflowId/observe` no longer contains duplicates from concurrent consumers.

Full resilience to a client disconnecting mid-run — so caching keeps going after the disconnect — depends on upstream PR #19745 and is not yet included.
