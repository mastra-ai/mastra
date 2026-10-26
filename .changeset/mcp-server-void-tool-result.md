---
'@mastra/mcp': patch
---

Fixed `MCPServer` replying with a JSON-RPC `-32602` "Invalid tools/call result" error when a tool's `execute` returns nothing. The tool had already run, so clients saw a failure after the side effect happened and could retry it. A tool that returns `undefined` (or another value JSON cannot represent, such as a function) now answers with a successful result and empty `content`. This also covers tools with an optional `outputSchema`. A `null` return is unchanged and still reaches clients as the text `"null"`.
