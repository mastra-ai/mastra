---
'@mastra/playground-ui': minor
---

Added answering an MCP server's input request from agent chat in Studio. When a tool backed by an MCP task needs input (a question, a form, or a link to open), the tool call now shows the server's request with Accept, Decline, and Cancel, and the task carries on once you answer. This works for tool calls that run in the background too, including after reloading the thread, and the chat stays free to send messages while the request is open. The task chip shows "input required" while it waits. If an answer doesn't go through, the request says why so you can answer again. A request with more than 20 questions or very large content shows a short notice with a single Cancel instead of the questions. In a network run, the request is shown but can't be answered from Studio yet.
