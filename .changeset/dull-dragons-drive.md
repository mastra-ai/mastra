---
'@mastra/factory': minor
---

Added plan review to Factory user sessions. When a task is ambiguous, spans several areas of the codebase, or the user asks to see the approach first, the agent explores read-only, writes a plan to `.artifacts/plans/`, and submits it for review before changing code. Approving the plan continues into the build in the same run. Small, clear changes still run straight away. Workspaces, sessions working on a board card, and Slack conversations are unchanged.
