---
'@mastra/core': minor
---

Add browser integration support for agents

- New `browser` property on agents for browser automation toolsets
- `MastraBrowser` base class with screencast streaming, input injection, and state management
- `ThreadManager` for browser session isolation per thread
- Browser tools are automatically available when a browser is configured on an agent
- New `@mastra/core/browser` export with browser types and utilities
