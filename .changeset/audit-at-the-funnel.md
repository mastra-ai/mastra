---
'@mastra/factory': patch
---

Audit stage moves, run starts and run ends where every path converges instead of at the browser routes. The transition service records `factory.work_item.stage_moved` / `transition_rejected` for every commit, whoever asked (a person, an agent, a rule, a GitHub event); the start coordinator records `factory.run.started` for every prepared kickoff, browser or dispatcher; a session observer records the new `factory.run.ended` with its reason. Rule-driven rows carry the new `system` actor type. Filing a session onto a role over PATCH is audited as an update, not a run start.
