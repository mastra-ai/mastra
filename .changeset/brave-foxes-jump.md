---
'@mastra/mcp': patch
---

Added explicit return type annotations to MCP resource methods to fix TypeScript declaration emit errors (TS2742) when resolving `zod` types from `.pnpm` paths.
