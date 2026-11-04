---
'@mastra/mcp-docs-server': patch
---

Fixed export lookups for installed Mastra packages. The docs server now reads `SOURCE_MAP.json` from `dist/docs/assets/SOURCE_MAP.json`, where packages publish it, and falls back to `dist/docs/SOURCE_MAP.json` for older package versions.
