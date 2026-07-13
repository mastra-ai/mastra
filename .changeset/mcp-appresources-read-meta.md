---
'@mastra/mcp': patch
---

Fixed `MCPServer` dropping a resource's `_meta` from `resources/read` results. The read handler rebuilt each content item with only `{ uri, mimeType, text | blob }`, so `appResources` (MCP Apps / SEP-1865) metadata attached during `resources/list` as `_meta: { ui: meta }` never reached the client. Hosts read the UI CSP from `contents[]._meta.ui.csp`, so `connectDomains` was silently ignored and widget `fetch`/XHR calls failed with `Failed to fetch`. The resource's `_meta` is now preserved on the read contents.
