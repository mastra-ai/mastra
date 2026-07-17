---
'@mastra/ai-sdk': patch
---

Fix durable agent streams that could terminate right after the initial `start` event, leaving the client with an empty response. Streams now continue through step boundaries and deliver the full reasoning, tool, and text output.
