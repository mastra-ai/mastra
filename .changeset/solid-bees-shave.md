---
'@mastra/core': patch
---

Fixed notification signal delivery to idle threads not including ifIdle with streamOptions. When GitHub notifications or heartbeats wake an idle agent thread, the request context (containing model selection) was missing, causing 'No model selected' errors. Added getNotificationStreamOptions callback to AgentNotificationConfig so the notification dispatcher can resolve stream options for deferred notifications.
