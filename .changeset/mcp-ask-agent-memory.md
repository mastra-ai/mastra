---
'@mastra/mcp': patch
---

`ask_<key>` tools generated from `MCPServer({ agents })` now accept optional `threadId` and `resourceId` arguments, pass `memory` to the agent so Memory-enabled agents keep their conversation history, and return the `threadId` they used. Without either id the agent runs without memory as before.
