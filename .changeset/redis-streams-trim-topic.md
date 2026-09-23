---
'@mastra/redis-streams': minor
---

Implemented `trimTopic` with `XTRIM MINID`, so thread streams drop entries for runs already saved to storage instead of growing to the length cap.
