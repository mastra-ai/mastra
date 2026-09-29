---
'@mastra/factory': patch
---

Fixed subagents in Factory sessions ignoring the project's default model. Explore, plan, and execute subagents now use the Factory default model instead of per-subagent models from the server's settings, which could name providers the Factory has no credentials for.
