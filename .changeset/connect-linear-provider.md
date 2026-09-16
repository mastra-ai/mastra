---
'@mastra/connect': minor
---

Added the generated Linear provider with 46 tools for issues, projects, cycles, teams, users, workflow states, comments, attachments, relations, and labels.

`connect()` now automatically exposes the Linear toolset when the project has a matching `linear` connection. Set `MASTRA_LINEAR_CONNECTION_ID` or pass `integrations.linear.connectionId` when the project has multiple Linear connections.
