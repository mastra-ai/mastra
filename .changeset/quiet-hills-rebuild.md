---
'@mastra/factory': patch
---

Fixed the `mastracode/web` dev commands so the Factory API always starts on the checked-out code. `dev:ui` and `build` now build every monorepo package `mastracode/web` links to, derived from its own package.json, instead of a hand-written list that had drifted: `@mastra/server`, the `mastra` CLI, `@mastra/hono`, `@mastra/deployer`, `@mastra/platform-workspace`, `@mastra/redis-streams` and `@mastra/e2b` were never rebuilt by `dev:ui`. Switching to a branch that touches one of them no longer needs a root build by hand.
