---
'@mastra/redis-streams': minor
---

Implemented `trimTopic(topic, { runId })`: pages through the stream with `XRANGE` and deletes that run's entries with `XDEL`. Thread streams drop entries for runs already saved to storage instead of growing to the length cap. Supports `producedBefore` to delete only a run's entries produced at or before a time, skipping approval and suspension prompts.
