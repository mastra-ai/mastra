# MCP status and reload command

## Origin PR / commit

- PR: [#13311](https://github.com/mastra-ai/mastra/pull/13311) — wire `mcpManager` into the TUI so `/mcp` can show status and reload servers.
- Later changes: [#13347](https://github.com/mastra-ai/mastra/pull/13347) — replaced the `MCPManager` class with `createMcpManager()` + `McpManager` interface while preserving status/reload/tool behavior; [#13613](https://github.com/mastra-ai/mastra/pull/13613) — added HTTP MCP server config and transport-aware statuses; [#14377](https://github.com/mastra-ai/mastra/pull/14377) — made `/mcp` default to an interactive selector with per-server actions, background init status, logs, reload-all, and reconnect-one flows; [#14960](https://github.com/mastra-ai/mastra/pull/14960) — gives the shared MCP client a seven-day timeout for long-running tool results.

## User-visible behavior

- What the user can do: run `/mcp` to open an interactive server selector, or `/mcp status` / `/mcp reload` for text fallback and reload-all.
- Success looks like: configured stdio/HTTP servers show real connected/error/skipped/connecting state, users can view tools/errors/logs, reconnect one server, reload all servers from the selector, and long-running MCP tools can finish without a short result-timeout abort.
- Must preserve: MCP tools can work in conversations and the command UI/selector must report the same manager state and timeout policy.

## Entry points / commands

- Commands / shortcuts / flags: `/mcp`, `/mcp status`, `/mcp reload`; selector keys `↑↓`, Enter, `r` reload all, Esc close/back.
- Automatic triggers: TUI startup passes the `mcpManager` returned by `createMastraCode()` into `MastraTUI`, starts `initInBackground()` after the UI owns the terminal, and inserts MCP failed/skipped notices into chat.

## TUI states

- Idle: `/mcp` opens the selector overlay; `/mcp status` prints a text summary.
- Modal: selector lists connected/failed/connecting/skipped servers, transport, tool count, per-server submenu actions, tool/error/log detail views, and reload-all progress.
- Active / error: startup background init, reload, and reconnect insert info messages for failed/skipped servers and reconnect results.

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
| MCP manager interface | `createMcpManager()` result / `TUIState.mcpManager`, including seven-day `MCPClient` timeout | `/mcp`, dynamic tools, cleanup, long-running MCP tools |
| Server statuses | `McpManager` closure state, including `transport` and transient `connecting` state | selector, text status, reload/reconnect UI, startup failure notices |
| Config paths/skipped servers | MCP config loader + manager closure state | `/mcp` setup instructions/status/selector |
| Captured stderr logs | `McpManager` per-server ring buffer (`MAX_STDERR_LINES = 200`) | selector log detail view |

## Key files

- `mastracode/src/main.ts` — passes `mcpManager` to `MastraTUI`.
- `mastracode/src/tui/state.ts` — stores `mcpManager` in options/state.
- `mastracode/src/tui/mastra-tui.ts` — starts MCP `initInBackground()` after UI start, shows failed/skipped notices, and includes `mcpManager` in slash-command context.
- `mastracode/src/tui/commands/mcp.ts` — `/mcp` setup/status/reload and interactive selector wiring.
- `mastracode/src/tui/components/mcp-selector.ts` — selector overlay, server list, submenu/detail views, reload-all/reconnect actions, polling, and log display.
- `mastracode/src/mcp/manager.ts` — `createMcpManager()` factory, MCP client timeout, server status, background init summary, reload, reconnect, logs.
- `mastracode/src/agents/tools.ts` — merges MCP tools from the manager interface into runtime tool set.

## Dependencies / related features

- [MCP server configuration](./mcp-server-configuration.md) — config files and stdio/HTTP server definitions feed this status UI.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — MCP tools join the visible/runtime tool set.
- [Interactive TUI chat](../tui/interactive-chat.md) — command messages and overlays render inside TUI.

## Existing tests

- `mastracode/src/mcp/__tests__/manager.test.ts` — `createMcpManager()` status/skipped/background init/reload/reconnect/tool collection/log accessor behavior and MCP client timeout handoff.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — routes `/mcp` to `handleMcpCommand` with the slash-command context that owns the manager.
- `mastracode/src/tui/commands/__tests__/mcp.test.ts` — direct `/mcp` command shield proving a configured manager opens the selector with live status/reload/reconnect/log callbacks instead of falling back to `MCP system not initialized.`
- `mastracode/scripts/mc-e2e/scenarios/integration-commands.ts` — real PTY/TUI e2e partial coverage proving `/mcp status` reaches the visible MCP status/fallback command surface in the transcript.
- `mastracode/scripts/mc-e2e/scenarios/mcp-http-tool-call.ts` — real PTY/TUI e2e coverage for a configured HTTP manager status row (`e2e_http_mcp [http]`) plus the same manager's tool availability in the model runtime.
- `mastracode/scripts/mc-e2e/scenarios/mcp-reload-config.ts` — real PTY/TUI e2e coverage for `/mcp reload` replacing an initial failing project-config stdio server with a newly loaded HTTP server and showing the reloaded status/tool row.

## Missing tests

- Focused `McpSelectorComponent` tests for navigation, detail views, reload-all, reconnect-one, polling, and stale reconnect results during reload.
- Remaining selector-driven TUI integration test for reload-all/reconnect-one actions updating status from the live manager; text `/mcp reload` is covered by `mcp-reload-config`.
- Real long-running MCP tool integration test proving the timeout handoff allows completion beyond the upstream short default.

## Known risks / regressions

- Command status can drift from actual tool availability if TUI context and `createDynamicTools()` receive different manager instances.
- Closure-state refactors must preserve background init, reload/reconnect lifecycle, config, tools, statuses, skipped servers, stderr logs, and the long MCP client timeout.
- Selector state is mostly untested at component level, so keyboard navigation and stale async reconnect/reload races are regression-prone.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
