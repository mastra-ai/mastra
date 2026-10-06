---
'@mastra/core': patch
---

Fixed batched channel messages from other senders skipping custom `onMention`, `onDirectMessage`, and `onSubscribedMessage` handlers when `burst`, `debounce`, or `queue` concurrency is set.

Your handler now runs once for each sender's turn, with its own `ctx.requestContext`, `ctx.signalMetadata`, and `ctx.skipped`. A handler can now be called several times for one dispatch.
