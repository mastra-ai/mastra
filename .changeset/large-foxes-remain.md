---
'@mastra/connect': patch
---

Agents now see a user's new tools as soon as they connect a provider through `userConnectRoutes()`. Previously the cached tool list could take up to 30 seconds to pick up a new connection (or drop a disconnected one); it now refreshes on the next resolution.
