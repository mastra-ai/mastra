---
'@mastra/discord': patch
'@mastra/teams': patch
---

Fixed apps installing two copies of `chat` when they use `@mastra/discord` or `@mastra/teams` with `@mastra/core`. Both packages now depend on their Chat SDK adapter with the same version range that `@mastra/core` uses for `chat` (^4.44.0), instead of pinning 4.40. Fixes [#29283](https://github.com/mastra-ai/mastra/issues/29283).
