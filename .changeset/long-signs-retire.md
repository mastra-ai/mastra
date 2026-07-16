---
'@mastra/client-js': patch
---

Fixed AgentControllerSession.subscribe() so it resolves only after the stream is established (rejecting when it cannot connect), retries with exponential backoff, and notifies consumers of re-established streams via a new onReconnect callback so they can re-sync missed events.
