---
'@mastra/core': patch
---

Fixed evented workflows returning a stale result from `run.resume()` on persistent pubsubs such as `@mastra/redis-streams` and `@mastra/valkey-streams`. Awaited `start()`, `resume()`, `restart()` and time-travel calls now only read finish events published after the call, so `resume()` returns the resumed result instead of the earlier `suspended` one, and waiting no longer re-reads the whole `workflows-finish` stream.
