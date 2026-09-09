---
'@mastra/factory': patch
---

Fixed the `mastracode/web` dev commands so the Factory API always starts on the checked-out code. `dev:ui` now runs the same `prebuild` step as `build` before starting the API, so `@mastra/server`, the `mastra` CLI, `@mastra/hono`, `@mastra/deployer`, `@mastra/platform-workspace`, `@mastra/redis-streams` and `@mastra/e2b` are rebuilt instead of served from a previous build. Switching to a branch that touches one of them no longer needs a root build by hand.
