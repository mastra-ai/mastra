---
'@mastra/redis-streams': minor
---

Implemented `trimTopic`: `XTRIM MINID` for a `before` cutoff, or `XTRIM MAXLEN 0` to drop every current entry. With this, thread streams drop entries for runs already saved to storage instead of growing to the length cap.
