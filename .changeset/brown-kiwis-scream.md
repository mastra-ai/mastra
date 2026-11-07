---
'@mastra/factory': patch
---

Fixed idle Factory servers querying the database every 20 seconds when the Platform GitHub integration is connected. The poller now remembers which repositories are linked and only re-reads them when a link changes (on any replica) or once an hour, so serverless databases such as Neon can suspend while Factory is idle.
