---
'@mastra/core': patch
---

Fixed durable thread streams replaying a queued or steered user message as still "sending" after a reconnect. On retaining transports such as Redis Streams and Valkey Streams, the pending announcement now leaves the thread stream when the run it waited on completes, so later `subscribeToThread()` calls no longer show it. Fixes #30792.
