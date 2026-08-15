---
'@mastra/core': minor
'@mastra/agentcore': minor
'@mastra/apple-container': minor
'@mastra/blaxel': minor
'@mastra/daytona': minor
'@mastra/docker': minor
'@mastra/e2b': minor
'@mastra/modal': minor
'@mastra/platform-workspace': minor
'@mastra/railway': minor
'@mastra/vercel': minor
---

Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Calling `handle.writer.end()` also closes stdin.
