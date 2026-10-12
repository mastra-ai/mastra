---
'@mastra/next': patch
'@mastra/tanstack-start': patch
---

Route handlers now retry initialization on the next request after a failed init, instead of failing every request until the process restarts. Concurrent requests during initialization still share a single init.
