---
'@mastra/factory': minor
---

Added plan review to Factory user sessions. Ask the agent for a plan, or to agree on the approach first, and it explores read-only, writes the plan to `.artifacts/plans/`, and submits it for review before changing code. Approving the plan continues into the build in the same run. Without that ask, the agent works directly. Workspaces, sessions working on a board card, and Slack conversations are unchanged.

Sessions that are not working on a board card no longer see the board-only `factory-plan`, `factory-triage` and `factory-complete-issue` skills. A request for a plan could load `factory-plan`, which skips the review card and ends on a board transition the session cannot make.
