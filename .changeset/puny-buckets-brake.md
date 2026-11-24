---
'@mastra/core': patch
---

Fixed durable thread streams replaying a queued or steered user message as still "sending" after a reconnect. On retaining transports such as Redis Streams and Valkey Streams, the pending announcement now leaves the thread stream when the run it waited on ends: right away for a successful run of an agent with memory, and 30 seconds later for a run without memory or one that fails, is canceled, or aborts. Later `subscribeToThread()` calls no longer show it. A message whose run died before delivering it can still replay as pending. Refs #30792.

On multi-process deployments, the process that owns a run now also records each forwarded user message it admits in a separate event that the run's trim keeps, so a forwarding process that reads the thread after that run ended still sees the admission and does not run the message a second time.
