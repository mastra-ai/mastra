---
'@mastra/code-sdk': patch
---

Fixed `agent_signal_send` reporting a signal as failed when it had been saved to the target agent's inbox. For signals that don't require a reply, when direct delivery fails but the notification is still pending, the tool now says the signal was queued, includes the delivery error, and suggests retrying with the same messageId. Signals sent with `expectsReply: true` still return an error in this case, because the reply obligation was not established.
