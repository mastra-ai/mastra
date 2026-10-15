---
'@mastra/core': patch
---

Fixed agent controller channel sessions losing the sender's identity on the first message in a new chat thread. A channel session now opens directly on its chat thread, keeping the inbound request context, instead of creating an extra empty thread and switching over without it. Hosts that resolve memory per user from the request context's `user` no longer fail on a new thread.
