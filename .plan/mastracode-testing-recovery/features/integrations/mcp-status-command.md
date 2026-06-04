# MCP status and reload command

## Origin PR / commit

- PR: [#13311](https://github.com/mastra-ai/mastra/pull/13311) — wire `mcpManager` into the TUI so `/mcp` can show status and reload servers.
- Later changes: [#13347](https://github.com/mastra-ai/mastra/pull/13347) — replaced the `MCPManager` class with `createMcpManager()` + `McpManager` interface while preserving status/reload/tool behavior; [#13613](https://github.com/mastra-ai/mastra/pull/13613) — added HTTP MCP server config and transport-aware statuses.

## User-visible behavior

- What the user can do: run `/mcp`, `/mcp status`, or `/mcp reload` to inspect configured MCP servers.
- Success looks like: configured stdio/HTTP servers show real connected/error/skipped state instead of `MCP system not initialized.`
- Must preserve: MCP tools can work in conversations and the command UI must report the same manager state.

## Entry points / commands

- Commands / shortcuts / flags: `/mcp`, `/mcp status`, `/mcp reload`.
- Automatic triggers: TUI startup passes the `mcpManager` returned by `createMastraCode()` into `MastraTUI`.

## TUI states

- Idle: `/mcp` opens the selector overlay; `/mcp status` prints a text summary.
- Active / modal / error: reload/reconnect actions show info/error messages from the manager result.

## Headless / non-TUI behavior

- Supported: headless initializes MCP in `headless.ts` for tool availability.
- Not supported / unknown: `/mcp` selector/status UI is TUI-only.

## Streaming / loading / interrupted states

- Streaming / loading: MCP connection is initialized in background after TUI start so status messages do not corrupt terminal output.
- Abort / retry / resume: server reconnect/reload state lives in the manager, not in chat history.

## Streaming vs loaded-from-history behavior

- While actively streaming: MCP tools come from the same manager merged into dynamic tools.
- After reload / history reconstruction: `/mcp` reads current manager/server status, not persisted chat messages.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| MCP manager interface | `createMcpManager()` result / `TUIState.mcpManager` | `/mcp`, dynamic tools, cleanup |
| Server statuses | `McpManager` closure state, including `transport` | selector, text status, reload/reconnect UI |
| Config paths/skipped servers | MCP config loader + manager closure state | `/mcp` setup instructions/status |

## Key files

- `mastracode/src/main.ts` — passes `mcpManager` to `MastraTUI`.
- `mastracode/src/tui/state.ts` — stores `mcpManager` in options/state.
- `mastracode/src/tui/mastra-tui.ts` — includes `mcpManager` in slash-command context.
- `mastracode/src/tui/commands/mcp.ts` — `/mcp` status/reload/selector behavior.
- `mastracode/src/mcp/manager.ts` — `createMcpManager()` factory, server status, reload, reconnect, logs.
- `mastracode/src/agents/tools.ts` — merges MCP tools from the manager interface into runtime tool set.

## Dependencies / related features

- [MCP server configuration](./mcp-server-configuration.md) — config files and stdio/HTTP server definitions feed this status UI.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — MCP tools join the visible/runtime tool set.
- [Interactive TUI chat](../tui/interactive-chat.md) — command messages and overlays render inside TUI.

## Existing tests

- `mastracode/src/mcp/__tests__/manager.test.ts` — `createMcpManager()` status/skipped/reload/reconnect/tool collection behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — routes `/mcp` to `handleMcpCommand` via command dispatcher.

## Missing tests

- Direct `/mcp` command test proving context includes `mcpManager` and no longer falls back to `MCP system not initialized.` when configured.
- TUI integration test for `/mcp reload` updating selector/status from the live manager.

## Known risks / regressions

- Command status can drift from actual tool availability if TUI context and `createDynamicTools()` receive different manager instances.
- Closure-state refactors must preserve reload/reconnect lifecycle: config, tools, statuses, skipped servers, and stderr logs.
- No focused command test covers the exact regression from #13311.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
