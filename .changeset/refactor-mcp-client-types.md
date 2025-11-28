---
'@mastra/mcp': patch
---

Refactor MCP client types to separate types.ts file

Extracted all type definitions from `client.ts` to a dedicated `types.ts` file for better code organization. All types are re-exported from both `client.ts` and `index.ts` for backwards compatibility.

