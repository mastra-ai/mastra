---
'@mastra/core': patch
---

Fixed thread peer discovery reporting live peers as absent when the caller was busy right after asking. Peers answer in a few milliseconds, but a caller whose event loop stayed busy past the 100 ms window closed it before reading any answer. The window now counts only time the caller could read replies, waiting at most one second longer for a busy caller. A peer that really is gone is still reported absent about one window after the caller is free.
