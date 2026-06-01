---
'@mastra/agent-browser': minor
---

Added extensibility hooks for custom browser providers (e.g. Firecrawl Browser Sandbox).

- New `createThreadManager` config option to inject a custom thread manager factory
- Exported `AgentBrowserThreadManager` class and related types (`AgentBrowserSession`, `AgentBrowserThreadManagerConfig`, `CreateAgentBrowserThreadManager`)
- Changed several internal members from `private` to `protected` to support subclassing
