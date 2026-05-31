---
'@mastra/core': minor
'@mastra/mcp': patch
---

Support conditional, function-based tool approvals.

- MCP tools that wrap a server-level `requireToolApproval` function are now honored end-to-end. The per-tool approval function was previously dropped when the agent converted MCP tools (it kept only the boolean flag), so conditional approval silently fell back to always-on. `CoreToolBuilder` now preserves a `needsApprovalFn` attached directly to a tool instance.
- The global `requireToolApproval` option on `agent.stream`/`agent.generate` now accepts a function in addition to a boolean. It is evaluated per tool call with the tool name, arguments, and request context, enabling policies such as regex allowlists on tool names. Returning `true` requires approval for that call; `false` allows it. On error the call defaults to requiring approval. When a function policy is set, tool calls run sequentially so approval suspensions don't race. Durable agents and stored agents continue to accept only a boolean (a function degrades to requiring approval for every call, since their options must be serializable).
```ts
// Approve only tool calls whose name is not on an allowlist.
const allowlist = /^(get|list|search)_/;
await agent.generate('...', {
  requireToolApproval: ({ toolName }) => !allowlist.test(toolName),
});
```

- Precedence is unchanged from before: a per-tool approval function (`createTool({ requireApproval: fn })` or an MCP-derived `needsApprovalFn`) is authoritative for that tool and overrides the global setting, so a tool can still opt out of approval by returning `false` even when the global option is on. The only new behavior is that the global option may now be a function in addition to a boolean.
- The previously implicit, runtime-attached per-tool approval predicate is now a typed contract: `@mastra/core` exports `NeedsApprovalFn` and declares the optional `needsApprovalFn` property on the `Tool` class. The MCP client and the agent runtime now share this typed contract instead of reaching through `any`. This is additive — no public API changes.
