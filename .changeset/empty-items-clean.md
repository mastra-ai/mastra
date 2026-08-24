---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Workspace no longer registers the lsp_inspect tool when LSP is not active, so agents are only offered the tool when it can actually run.
