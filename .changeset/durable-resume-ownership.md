---
'@mastra/server': patch
---

Fixed an authorization gap in `resume-stream` and `resume-stream-until-idle` for durable agents. Resuming a durable run now checks that the run exists, belongs to the caller, is suspended, and matches the requested thread; otherwise the request returns 403.
