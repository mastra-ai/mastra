---
'@mastra/core': minor
---

Added optional, experimental `getEventsInfo()` and `getEventsInspector()` members to `MCPServerBase`, plus the event info types (`MCPServerEventInfo`, `MCPServerEventStreamFrame`, `MCPServerEventsInspector`, …) and `MCP_SERVER_EVENT_ERROR_IDS`. Servers that declare MCP events use them to let Studio list, poll, stream and test-emit their event types. Servers without events don't need to implement them.
