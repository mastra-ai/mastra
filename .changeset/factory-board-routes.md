---
'@mastra/factory': minor
---

Serve the board catalog, work items, and live state (decisions, run queue) through standalone route classes that need only Factory storage, so another server can mount them. Board phases can be run by any agent: a phase with an `agentId` queues a run on arrival without needing a skill, and may set a `goal` without one.
