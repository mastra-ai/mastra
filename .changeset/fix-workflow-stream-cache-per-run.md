---
"@mastra/server": patch
---

Fixed `/stream`, `/resume-stream`, and `/time-travel-stream` writing duplicate chunks to the workflow run cache when two clients streamed the same run at the same time. The history replayed by `POST /workflows/:workflowId/observe` no longer contains duplicates from concurrent consumers.

Caching also survives the only client disconnecting mid-run: the run's history keeps being cached through to the end, so a client that later reconnects to `/observe` still replays it in full. That part depends on #19745, which has since landed.
