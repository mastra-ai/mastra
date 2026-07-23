---
'@mastra/client-js': minor
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added the `transient` option to `sendSignal` params. Set `transient: true` to deliver a signal to the model for the current call only, without retaining it in thread history.
