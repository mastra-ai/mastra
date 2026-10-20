---
'@mastra/core': patch
'@mastra/client-js': patch
---

Fixed durable and evented agents losing the conversation when a client tool is approved or declined on an agent without memory. The finish chunk now carries the same `messages` history as the default agent, so the follow-up model request keeps the original user prompt, the tool call and the tool result. The client tool also runs once: the first stream of a durable run stays open after suspension, and it no longer re-runs the tool that the approve or decline request already handles.
