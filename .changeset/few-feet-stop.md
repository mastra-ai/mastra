---
'@mastra/mcp-docs-server': minor
---

Restructure and tidy up the MCP Docs Server. It now focuses more on documentation and uses fewer tools.

Removed tools that sourced content from:

- Blog
- Package changelog
- Examples

The local docs source is now using the generated llms.txt files from the official documentation, making it more accurate and easier to maintain.
