---
'@mastra/core': patch
---

Fixed durable agent tool calls swallowing fine-grained authorization (FGA) denials. When a tool call is denied by the FGA provider, the durable run now fails instead of passing the denial back to the model as a retryable tool error, matching the behavior of non-durable agents.
