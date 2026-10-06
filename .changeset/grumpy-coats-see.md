---
'@mastra/client-js': patch
'@mastra/core': patch
---

Removed the @experimental annotation from Agent signal APIs (sendSignal, subscribeToThread, sendMessage, queueMessage, cancelQueuedMessages, abortThread, state and notification signals, and signal providers) now that signals are stable.
