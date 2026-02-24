---
'@mastra/core': patch
---

Fixed workspace registry to track source ownership. `listWorkspaces()` now returns `RegisteredWorkspace` entries that include `source` (`'mastra'` or `'agent'`), `agentId`, and `agentName` metadata, so consumers can distinguish global workspaces from agent-scoped ones without re-deriving ownership.
