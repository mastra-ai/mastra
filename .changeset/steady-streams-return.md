---
'@mastra/factory': patch
---

Fixed chat state staying stale after a connection drop: when the event stream reconnects, the session state is refetched along with the messages, so a run that started or ended during the gap is reflected right away.
