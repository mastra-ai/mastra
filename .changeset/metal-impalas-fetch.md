---
'@mastra/mcp': patch
---

`listTools()` now logs a warning when two server and tool pairs produce the same `serverName_toolName` key, such as server `local` with tool `x_status` and server `local_x` with tool `status`. Before, one tool replaced the other with no message. The warning names both pairs, and `toolsFromDefinitions()` warns the same way. Which tool keeps the key is unchanged. See [#29360](https://github.com/mastra-ai/mastra/issues/29360).
