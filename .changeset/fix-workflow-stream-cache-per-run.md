---
"@mastra/server": patch
---

Fixed workflow stream caching being attached per subscriber instead of per run. Every `/stream`, `/resume-stream` and `/time-travel-stream` request added its own caching transform keyed by `runId`, so two concurrent consumers of the same run wrote every chunk to the cache twice, and — more importantly — caching stopped as soon as that one consumer disconnected. The history replayed by `POST /workflows/:workflowId/observe` was therefore truncated and missing `workflow-finish` exactly in the case it exists for: a client reconnecting after a drop. A single cache pump per run, independent of any client connection, now feeds the cache.
