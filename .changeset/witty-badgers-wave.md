---
'@mastra/factory': patch
---

Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages.
