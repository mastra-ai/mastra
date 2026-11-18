---
'@mastra/core': patch
---

Messages no longer stay stuck as "sending" after a client reconnects to a durable thread.

Queuing or steering a message on a thread that is already running announces it with a pending presentation on the thread's event stream. That announcement was published under the thread key instead of the run id, so the cleanup that drops a finished run from the stream could never match it. It stayed on the stream for the transport's idle TTL (7 days by default on Redis Streams and Valkey Streams) and was replayed to every new `subscribeToThread()` call. Clients joining later rendered the old message as sending again, and when the process holding a queued message died before answering it the stale row never went away.

Presentations (pending, queued, cancelled, and delivered markers) now carry the id of the run that owns them, so that run's completion removes them from the stream like every other entry it produced.

Fixes #30792
