---
'@mastra/factory': patch
---

Stop the Platform GitHub event worker from reading linked repositories from the Factory database every 20 seconds. The list is now cached and reread when a project links a repository (on any replica) or hourly. A quiet Factory only polls the Platform event log, and one with no linked repositories sleeps until a link wakes it. Serverless Postgres such as Neon can now suspend while the Factory is idle.
