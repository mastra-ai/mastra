---
'@mastra/factory': patch
---

Stop a Factory with no linked GitHub repositories from querying its database every 20 seconds. The Platform GitHub event worker now sleeps while no repository is linked and polls as soon as a project links one, on any replica. An hourly recheck covers a lost wake. Serverless Postgres such as Neon can now suspend while such a Factory is idle.
