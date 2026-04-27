---
'@mastra/deployer': patch
'@mastra/server': patch
---

Fixed agent-builder not appearing in the agent list on first load when builder is enabled. The builder agent is now eagerly resolved during server startup (after the EE license check) so it's already registered before the first request to GET /agents.
