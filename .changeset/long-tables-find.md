---
'@mastra/playground-ui': minor
'@mastra/server-adapters-test-suite': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'@mastra/mcp': patch
---

Added answering an MCP server's input request from agent chat in Studio. When a tool backed by an MCP task needs input (a question, a form, or a link to open), the tool call now shows the server's request with Accept, Decline, and Cancel, and the task carries on once you answer. This works for tool calls that run in the background too, including after reloading the thread, and the chat stays free to send messages while the request is open. The task chip shows "input required" while it waits.
