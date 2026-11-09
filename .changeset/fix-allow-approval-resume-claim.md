---
'@mastra/core': patch
---

Fixed an issue where an AgentController session could lose a tool call that its permission policy auto-allows, failing with `AGENT_RESUME_ALREADY_CLAIMED`. It happened mostly on stores with real write latency, such as PostgreSQL. A suspended run no longer gives a new timestamp to a suspension it saves twice, and the second save no longer overwrites a resume that already claimed the run on stores with guarded snapshot writes (PostgreSQL, LibSQL, MySQL, MSSQL, DSQL, D1, in-memory). Other stores check the run's status before the second save, which makes the overwrite much less likely.
