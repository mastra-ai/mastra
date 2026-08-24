---
'@mastra/factory': minor
---

Factory exposes session command discovery and preparation at `/web/agent-controller/:controllerId/commands/discover|prepare`. Browsers can list and run repository custom commands and user-invocable skills expanded inside the addressed session's workspace instead of on the host. Session workspaces also pick up user-global skill directories when auth is disabled and server-installed plugin skills.
