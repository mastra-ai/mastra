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

Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin.
