---
'@mastra/core': patch
'@mastra/stagehand': patch
'mastracode': patch
---

Fixed the browser failing with `ECONNREFUSED` when launched again on a profile it had used before.

Before launching a local browser profile, Mastra now clears the launcher logs left by earlier launches (`chrome-err.log`, `chrome-out.log`), which made the next launch connect to the old, dead DevTools port. It also removes a Chrome profile lock left by a browser that is no longer running. If a browser that is still running holds the profile, launch fails with a `BrowserProfileInUseError` that names the profile and the holding process. Remote browsers (`cdpUrl`, Browserbase) are not affected.

Mastra Code now closes its browser when it exits, when it relaunches, and when `/browser` replaces or disables it.
