---
'@mastra/core': patch
---

Fixed evented workflows on a persistent pubsub such as Redis Streams or Valkey Streams re-reading the whole finish stream every time a caller awaits `run.start()` or `run.resume()`. A resumed run could also resolve with its own earlier `suspended` result instead of the resumed one. The wait for a run's result now only reads events published after the run starts. Fixes [#26247](https://github.com/mastra-ai/mastra/issues/26247).
