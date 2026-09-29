---
'@mastra/server-adapters-test-suite': patch
---

Allow `@mastra/mcp` 2.x in the peer dependency range. The two MCP transport tests that expect the legacy SSE routes to be removed now skip when running against `@mastra/mcp` 1.x, so out-of-tree adapters pass on either major version.
