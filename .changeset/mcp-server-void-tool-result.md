---
'@mastra/mcp': patch
---

Fixed `MCPServer` returning an "Invalid tools/call result" error when a tool's `execute` returns no value. The tool had already run. Clients saw a failure and could retry the call, which runs the side effect again. Now a tool that returns `undefined`, or a function, sends a successful result with empty `content`. A `null` return does not change. Clients still receive the text `"null"`.

A tool with an optional `outputSchema` that returns `undefined` now sends an error result that names the tool. A successful result for such a tool must include structured output, so clients that list tools first used to reject the reply.
