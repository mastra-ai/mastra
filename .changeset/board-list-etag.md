---
'@mastra/factory': patch
---

The board listing no longer re-sends every card on each refresh. Each open tab refetched the whole board (megabytes on large projects) every few seconds, and the server serialized it again each time, stalling the process. The listing now builds its body once per board version and run activity, answers repeat reads with `304 Not Modified` via an `ETag`, and gzips the body for clients that accept it.
