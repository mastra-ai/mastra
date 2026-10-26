---
'@mastra/core': patch
---

Improved the scheduler so it no longer queries storage every 10 seconds when nothing is due. It now waits until the next schedule is due. Schedules created, updated or resumed through Mastra wake it right away, and it checks storage at least every 15 minutes for schedules written in other ways. A scheduler turned on with `scheduler: { enabled: true }` keeps checking at the configured interval, so dedicated scheduler processes still find schedules from processes they share no pubsub with.
