---
"@mastra/mcp-docs-server": minor
---

feat(mcp-docs-server): add embedded docs MCP tools

Adds 5 new MCP tools to read embedded documentation from installed @mastra/* packages:

- listInstalledMastraPackages: Discover packages with embedded docs
- readMastraSourceMap: Read export mappings from SOURCE_MAP.json
- findMastraExport: Get type definitions and implementation for specific exports
- readMastraEmbeddedDocs: Read topic documentation
- searchMastraEmbeddedDocs: Search across all embedded docs

These tools enable AI coding agents to understand Mastra packages by reading documentation directly from node_modules.
