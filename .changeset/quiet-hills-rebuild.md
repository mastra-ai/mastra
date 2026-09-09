---
'@mastra/factory': patch
---

Fixed the `mastracode/web` dev commands so the Factory API always starts on the checked-out code. `dev:ui` now builds `@mastra/server`, `@mastra/hono`, `@mastra/deployer`, the `mastra` CLI, `@mastra/platform-workspace`, `@mastra/redis-streams` and `@mastra/e2b` before starting the API, and `build` includes `@mastra/e2b`. Switching to a branch that touches one of those packages no longer needs a root build by hand.
