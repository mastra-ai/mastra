---
'@mastra/factory': patch
---

Fixed new Factory sessions stalling for minutes when the background decision queue was deep. The dispatcher now claims pending session starts before deferred decisions, so a new session always starts on the next tick.
