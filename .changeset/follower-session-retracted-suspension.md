---
'@mastra/core': patch
---

Fixed a Session that follows a thread keeping a parked tool call after another Session aborted the run, or after the resumed run ended with a non-success finish such as `content-filter`. The follower now ends the run and retracts the call with `tool_suspension_cancelled`, so `suspensions.hasPending()` returns false. This also works when the follower runs in a different Mastra instance that shares the same pubsub ([#26997](https://github.com/mastra-ai/mastra/issues/26997)).
