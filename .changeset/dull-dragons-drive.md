---
'@mastra/factory': minor
---

Added a `/plan` command to Factory user sessions. Type `/plan <task>` as the first message of a new session or inside an existing one: the agent is told to explore the code read-only, write the plan to `.artifacts/plans/`, and submit it for review. Approving the plan continues into the build in the same run. A bare `/plan` plans the task discussed so far. Board, workspace, supervisor and Slack sessions are unchanged.
