---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Fixed `agent_signal_send` reporting a signal as failed when it was actually saved to the target agent's inbox. When direct delivery fails but the notification is still pending, the tool now says it was queued, includes the delivery error, and suggests retrying with the same messageId.
