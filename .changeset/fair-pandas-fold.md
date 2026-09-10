---
'@mastra/client-js': patch
---

Fixed agent controller subscriptions delivering queued events or late errors after unsubscribe and leaving a response open when unsubscribing during reconnection.
