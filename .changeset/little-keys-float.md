---
'mastra': patch
'@mastra/factory': patch
---

Factory chat no longer re-renders on every status update that changes nothing. While a reply streams, the agent sends a status snapshot many times a second; snapshots that repeat the token usage, memory progress and buffering state already on screen are now skipped.
