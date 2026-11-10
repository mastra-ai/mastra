---
'@mastra/factory': patch
---

Stop an idle Factory from querying its database every second. The decision dispatcher now sleeps when there is no work and wakes when a run start or decision is queued, when a retry or expired lease comes due, or when another replica queues work through the Factory pubsub. Serverless Postgres such as Neon can now suspend while the Factory is idle.
