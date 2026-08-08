---
'@mastra/redis-streams': patch
'@mastra/core': patch
---

Fixed thread event subscriptions so successfully handled events are acknowledged and persistent backends do not accumulate pending deliveries.
