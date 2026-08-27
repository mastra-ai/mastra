---
'@mastra/playground-ui': patch
---

Added a search field to the trace timeline in Studio. Type in it to narrow a trace down to the spans you care about: it matches on span name, span type, entity name, input preview, trace ID and span ID, all case-insensitively.

A matching span is never shown out of context. Its full parent chain stays visible so you can see where it sits in the trace, and its own children stay visible too, so searching for a tool call still shows you what that tool call did. Clearing the field restores the whole trace.
