---
'@mastra/core': patch
---

Tool results from an agent's `workflows` are now marked so `@mastra/observability` can show them in the next model step span instead of `[tool-result: workflow-<name>]`. The tool output sent to the model is unchanged. Tool-result chunks and saved messages for workflow tools now include `providerMetadata.mastra.workflowTool: true`. Fixes #30219.
