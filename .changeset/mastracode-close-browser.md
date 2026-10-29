---
'mastracode': patch
'@mastra/code-sdk': patch
---

Mastra Code now closes its browser when it exits, when it relaunches, and when `/browser` replaces or disables it, so a leftover Chrome no longer keeps the browser profile locked. A replaced browser cannot be relaunched by a tool call that was already running. If it does not close within 5 seconds, Mastra Code kills its Chrome on macOS and Linux. On Windows it cannot force-kill Chrome.

`@mastra/code-sdk` now needs `@mastra/core` 1.81.0 or later, the first version that clears stale Chrome launcher logs and locks.
