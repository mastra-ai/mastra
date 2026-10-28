---
'@mastra/core': patch
'@mastra/stagehand': patch
'mastracode': patch
---

Fixed the browser staying broken with `ECONNREFUSED` after an earlier Chrome was left running on the same profile.

Before launching a local browser profile, Mastra now checks the profile's Chrome lock. A lock left by a browser that is no longer running is removed so the launch succeeds. If another browser really is using the profile, launch fails with a `BrowserProfileInUseError` that names the profile and the holding process, instead of a bare connection error. Remote browsers (`cdpUrl`, Browserbase) are not checked.

Mastra Code now closes its browser when it exits and when `/browser` replaces or disables it, so it no longer leaves Chrome running with the profile locked.
