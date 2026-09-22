---
'@mastra/mcp-docs-server': patch
---

Pinned the docs server to the published `@mastra/mcp` 1.x line instead of the workspace version. `@mastra/mcp` 2.x only speaks the 2026-07-28 MCP revision, and the editors that run `npx @mastra/mcp-docs-server` over stdio still connect with the earlier handshake, so the docs server stays on 1.x until those hosts move.
