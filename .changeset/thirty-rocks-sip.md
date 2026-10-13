---
'@mastra/core': patch
---

Fixed untilIdle streams dropping background tasks started by the run they replaced: a new stream({ untilIdle: true }) on the same thread aborts the earlier idle wrapper, and the new wrapper only tracked tasks whose events it saw itself — so an in-flight task's completion woke nobody and the agent never reported its result. The idle loop now adopts still-running and pending background tasks for its agent, thread, and resource when it starts, so their completions trigger a continuation turn as usual. Fixes #26841
