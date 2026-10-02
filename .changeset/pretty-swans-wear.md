---
'@mastra/core': patch
---

Fixed batched channel messages from other senders bypassing custom onMention, onDirectMessage and onSubscribedMessage handlers under burst, debounce or queue concurrency: the handler now runs once per sender's turn with its own request context, so a handler may be called several times per dispatch.
