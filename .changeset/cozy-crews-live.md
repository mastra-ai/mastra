---
'@mastra/core': patch
---

Workspace-action journal now reflects `HarnessConfig.workspace.policy` decisions for file, command, network, and MCP actions, with the caller-passed decision preserved as `actor.callerDecision` for traceability.
