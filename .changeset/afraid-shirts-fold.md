---
'@mastra/server': patch
---

Fixed session event streams to send the current display snapshot on initial connection and reconnect. Session state reads now return one active-thread snapshot, including tasks, queued follow-ups, and memory buffering flags. A request for another owned thread returns HTTP 409 instead of mixing state from different threads.
