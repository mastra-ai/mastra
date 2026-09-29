---
'@mastra/factory': patch
---

Fixed subagents in Factory sessions ignoring the project's default model. Explore, plan, and execute subagents now use the Factory default model instead of per-subagent models from the server's settings, which could name providers the Factory has no credentials for.

In Slack threads, subagents follow the sender's active model pack (explore uses the pack's fast model, plan uses plan, execute uses build), matching the main agent. When the sender has no pack they use the Factory default.
