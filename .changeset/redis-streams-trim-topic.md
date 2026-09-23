---
'@mastra/redis-streams': minor
---

`publish` now returns the stream entry ID, and `trimTopic` deletes those entries with `XDEL`. Thread streams drop entries for runs already saved to storage instead of growing to the length cap.
