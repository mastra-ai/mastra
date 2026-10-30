---
'@mastra/server': patch
---

Agent generate and stream routes now respond with HTTP 400 instead of 500 when the request context fails the agent's `requestContextSchema`. This applies to regular and durable agents, so clients and monitors no longer treat a bad request as a server failure.
