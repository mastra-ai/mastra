---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/mcp-docs-server': patch
---

Fixed `SOURCE_MAP.json` in the embedded package docs. It previously listed minified names such as `t` and `n` instead of public exports, so MCP docs tools could not find `Agent`, `createTool` or `Mastra`. The map now lists every public export with the `.d.ts` file that declares it and the line of its implementation. The MCP docs server also reads the map from its current location, `dist/docs/assets/SOURCE_MAP.json`.
