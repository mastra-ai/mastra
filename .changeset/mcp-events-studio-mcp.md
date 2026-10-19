---
'@mastra/mcp': minor
---

`MCPServer` now exposes its declared events to Studio (experimental). `getEventsInfo()` returns the same descriptors as `events/list`, plus whether each type can be emitted. `getEventsInspector()` polls and streams an event type through the same code path as the `events/poll` and `events/stream` requests, and sends test events whose `eventId` starts with `mastra-test-`. The MCP wire protocol is unchanged.
