---
'@mastra/factory': patch
---

Fixed Factory runs that showed as 0 seconds long. When a role's kickoff was queued onto a session that was already working, the run's start was recorded only once that work finished. Runs now start when their kickoff reaches the agent, so the Activity page shows how long each agent actually worked.
