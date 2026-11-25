---
'@mastra/core': patch
---

A message sent to an agent is now stored as soon as the run has accepted it, before the model is asked to reply, instead of only at the end of the turn. Reloading a chat while the reply is still being written now shows your message.

The message is only stored after input processors let it through, so a blocked message is never stored and never reaches a later prompt. Messages queued behind a running reply are stored when their own run takes them, so history keeps the order you sent them in, and a cancelled queued message is never stored. Until then, a reload does not show a queued message. Nothing is stored early when memory is read-only, the user may not write to the thread, or memory is managed by the Mastra gateway. If that early save fails, the run continues and the turn's own save stores the message.
