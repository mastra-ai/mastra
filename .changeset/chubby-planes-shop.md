---
'@mastra/core': patch
---

Add support for AI SDK's `needsApproval` in tools. Tools created with AI SDK's `tool()` function can now use `needsApproval` (boolean or function) which will be mapped to Mastra's internal `requireApproval` system. This enables tool execution approval for both Mastra tools (`createTool` with `requireApproval`) and AI SDK tools (`tool` with `needsApproval`). Also fixes `isVercelTool()` to recognize AI SDK v6 tools that use `inputSchema` instead of `parameters`.
