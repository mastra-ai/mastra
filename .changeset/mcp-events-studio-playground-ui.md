---
'@mastra/playground-ui': minor
---

MCP event notifications in agent threads now read `<server> · <event>` instead of the generic `mcp-events / mcp-event`. The body is labelled as untrusted MCP server data, and an occurrence that followed a gap gets a "gap" badge ("Gap: events may have been skipped"). `NotificationActivity` accepts optional `extraBadges` and `messageLabel` props.
