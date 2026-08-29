---
'@mastra/core': patch
'@mastra/mcp': patch
---

Fixed MCP tools handing malformed structured output to the model. When a tool advertises an `outputSchema`, its `structuredContent` is now validated against that schema before it reaches the model, matching how tools created with `createTool` already behave. On a mismatch the model receives a structured validation error it can recover from, instead of acting on the invalid payload. This also covers tools rebuilt from a cached definition (toolsets loaded without a live `tools/list` call), which previously had no output validation at all.

Validation is skipped for an `outputSchema` that cannot be compiled (for example an unresolvable remote `$ref`), so those tools keep returning their results unchanged rather than failing every call.

For consumers using `onToolError: 'return'`: an errored result (`isError: true`) that also carries `structuredContent` now returns the full `CallToolResult` envelope (`isError`, `content`, `_meta`) instead of the bare structured value.
