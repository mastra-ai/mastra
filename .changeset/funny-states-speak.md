---
'@mastra/mcp': patch
---

Fixed `MCPServer` rejecting `resources/read` for URIs built from an advertised resource template. A URI that matches one of the caller's `resourceTemplates` is now passed to `getResourceContent` and returned with the template's `mimeType` and `_meta`, instead of failing with `Resource not found`. Listed resources still take precedence. Fixes [#29455](https://github.com/mastra-ai/mastra/issues/29455).
