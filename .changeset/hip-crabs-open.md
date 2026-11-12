---
'@mastra/core': patch
---

The agent now logs a warning when two toolsets expose a tool with the same name, such as `search` from two MCP servers passed with `mcp.listToolsets()`. Before, one tool replaced the other with no message. The warning names both toolsets. The tool from the later toolset still reaches the model, as before. See [#29360](https://github.com/mastra-ai/mastra/issues/29360).
