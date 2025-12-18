---
'@mastra/server': patch
---

Add execution metadata to A2A message/send responses. The A2A protocol now returns detailed execution information including tool calls, tool results, token usage, and finish reason in the task metadata. This allows clients to inspect which tools were invoked during agent execution and access execution statistics without additional queries.
