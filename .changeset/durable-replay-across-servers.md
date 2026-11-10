---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed reconnecting to a finished durable or evented agent run from a server other than the one that ran it. While the run's output is still retained (30 seconds by default), `POST /agents/:agentId/observe` now replays it from any server that shares the cache, instead of returning 404. Access checks are unchanged: other users and callers without read access to the run's thread are still refused, stopping a run still requires write access, and the run returns 404 once its output is cleaned up.
