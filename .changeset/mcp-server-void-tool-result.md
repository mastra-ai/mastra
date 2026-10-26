---
'@mastra/mcp': patch
---

Fixed `MCPServer` returning an "Invalid tools/call result" error when a tool's `execute` returns no value. The tool had already run. Clients saw a failure and could retry the call, which runs the side effect again. Now a tool that returns `undefined`, or a function, sends a successful result with empty `content`. This also applies to tools with an optional `outputSchema`. A `null` return does not change. Clients still receive the text `"null"`.
