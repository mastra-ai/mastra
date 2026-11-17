---
'@mastra/valkey-streams': patch
---

`ValkeyStreamsPubSub` now reports `redeliversUnacked` as `true` while its reclaim loop runs (`reclaimIntervalMs` above 0). Workflow recovery then leaves evented runs to the stream's pending list instead of restarting them on every booting instance (#28712). Keep `reclaimIdleMs` at 30 seconds or more (the default is 60 seconds).
