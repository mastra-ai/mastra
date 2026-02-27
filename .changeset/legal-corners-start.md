---
'@mastra/core': minor
'mastracode': patch
---

Added /quorem feature for parallel agent execution. The Harness now supports launching multiple quorem agents that work independently in isolated environments, each with a cloned thread containing full conversation context. After all agents complete, the main agent reviews their results, selects a winner, and merges the winning agent's changes.

**New types:** `QuoremAgentConfig`, `QuoremSessionConfig`, `QuoremAgentState`, `QuoremSession`, `QuoremEnvironmentConfig`

**New Harness methods:** `startQuoremSession()`, `reviewQuoremAgent()`, `selectQuoremWinner()`, `cancelQuoremSession()`, `getQuoremSession()`

**New tools:** `quorem` (starts a parallel session) and `quorem_select` (picks a winner)

**New events:** `quorem_start`, `quorem_agent_start`, `quorem_agent_progress`, `quorem_agent_end`, `quorem_review_start`, `quorem_merged`, `quorem_cancelled`

Environment management (creating, removing, merging isolated environments) is injected via `QuoremEnvironmentConfig`, keeping the core decoupled from any specific isolation strategy.
