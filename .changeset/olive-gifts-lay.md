---
'@mastra/core': minor
'mastracode': patch
---

Added Quorem parallel agent feature to the Harness. The main agent can now delegate a task to multiple parallel "quorem" agents, each running in an isolated environment with a cloned conversation thread. After all agents complete, the main agent reviews results, picks a winner, and merges their changes.

**New types:** `QuoremAgentConfig`, `QuoremSessionConfig`, `QuoremAgentState`, `QuoremSession`, `QuoremEnvironmentConfig`

**New Harness methods:** `startQuoremSession()`, `reviewQuoremAgent()`, `selectQuoremWinner()`, `cancelQuoremSession()`, `getQuoremSession()`

**New tools:** `quorem` (starts a parallel session) and `quorem_select` (picks a winner)

**New events:** `quorem_start`, `quorem_agent_start`, `quorem_agent_progress`, `quorem_agent_end`, `quorem_review_start`, `quorem_merged`, `quorem_cancelled`

Environment management is injected via `QuoremEnvironmentConfig`, keeping the core decoupled from any specific isolation strategy (git worktrees, containers, temp dirs, etc).
