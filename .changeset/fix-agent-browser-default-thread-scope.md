---
"@mastra/agent-browser": patch
"@mastra/core": patch
---

Fixed AgentBrowser failing to initialize when using default thread scope. Browser now correctly creates a dedicated session for the default thread ID instead of falling back to an uninitialized shared manager.
