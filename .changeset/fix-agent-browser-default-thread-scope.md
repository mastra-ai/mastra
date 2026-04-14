---
"@mastra/agent-browser": patch
"@mastra/core": patch
---

AgentBrowser with default thread scope now initializes correctly. Previously, calling launch() followed by getPage() would throw "Browser not launched" when no explicit thread ID was provided.
