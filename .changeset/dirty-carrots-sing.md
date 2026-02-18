---
'@mastra/core': patch
---

Fixed a bug where `requestContext` metadata was not propagated to child spans. When using `requestContextKeys`, only root spans were enriched with request context values — child spans (e.g. `agent_run` inside a workflow) were missing them. All spans in a trace are now correctly enriched. Fixes #12818.
