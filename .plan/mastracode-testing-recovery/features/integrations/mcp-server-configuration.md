# MCP server configuration

## Origin PR / commit

- PR: [#13613](https://github.com/mastra-ai/mastra/pull/13613) — added HTTP MCP server config support, headers, OAuth metadata, and transport-aware manager status.
- Related origin: [#13311](https://github.com/mastra-ai/mastra/pull/13311) — made `/mcp` status/reload use the live MCP manager; [#13347](https://github.com/mastra-ai/mastra/pull/13347) — refactored manager into `createMcpManager()`.

## User-visible behavior

- What the user can do: configure MCP servers in `.mastracode/mcp.json`, global `~/.mastracode/mcp.json`, or Claude-compatible `.claude/settings.local.json` using either stdio `command` entries or HTTP `url` entries.
- Success looks like: valid stdio and HTTP MCP servers connect, expose namespaced tools, show transport (`stdio`/`http`) in `/mcp status`, and invalid entries are skipped with reasons.
- Must preserve: project config overrides global config by server name, global overrides Claude config, and skipped lower-priority entries disappear when a valid higher-priority server exists.

## Entry points / commands

- Commands / shortcuts / flags: `/mcp`, `/mcp status`, `/mcp reload`; configuration files under project/global/Claude paths.
- Automatic triggers: `createMcpManager(projectDir)` loads merged config at startup; TUI initializes MCP in the background after UI start; headless initializes MCP for tool availability.

## TUI states

- Idle: `/mcp` shows setup instructions when no configured or skipped servers exist, including stdio and HTTP examples.
- Active / modal / error: `/mcp status` displays transport and skipped reasons; reload/reconnect actions update server statuses from the manager.

## Headless / non-TUI behavior

- Supported: headless mode initializes the same manager so configured stdio/HTTP MCP tools are available to agent runs.
- Not supported / unknown: OAuth browser/device interaction for HTTP MCP in headless mode needs direct verification; config parsing/storage is shared.

## Streaming / loading / interrupted states

- Streaming / loading: MCP connection happens outside message streaming; connected MCP tools join the dynamic tool set before/while runs are built.
- Abort / retry / resume: server reload/reconnect is manager closure state, not chat history; failed/skipped servers remain visible through status APIs.

## Streaming vs loaded-from-history behavior

- While actively streaming: MCP tools are namespaced as `serverName_toolName` and can be called like other tools.
- After reload / history reconstruction: past MCP tool results render from stored messages; current `/mcp` status reflects freshly loaded manager/config state, not historical connection state.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Project MCP config | `<project>/.mastracode/mcp.json` | config loader, `/mcp` setup display |
| Global MCP config | `~/.mastracode/mcp.json` | config loader, `/mcp` setup display |
| Claude-compatible config | `<project>/.claude/settings.local.json` `mcpServers` | config loader lowest-priority source |
| Merged server map | `loadMcpConfig()` / `mergeConfigs()` | `createMcpManager()` |
| Skipped servers | config validation result | `/mcp status`, selector, init summary |
| Runtime statuses/tools/logs | `McpManager` closure state | `/mcp`, dynamic tools, cleanup |
| HTTP OAuth tokens | app-data `mcp-oauth/<fingerprint>.json` | `MCPOAuthClientProvider` |

## Key files

- `mastracode/src/mcp/config.ts` — config path loading, stdio/http classification, OAuth validation, merge precedence, skipped-entry tracking.
- `mastracode/src/mcp/types.ts` — stdio/http/OAuth/skipped/status types and `transport` field.
- `mastracode/src/mcp/manager.ts` — server definition building, `MCPClient` construction, HTTP URL/request headers/OAuth provider, status/tool/log lifecycle.
- `mastracode/src/tui/commands/mcp.ts` — `/mcp` setup examples, text status, reload/reconnect selector integration.
- `mastracode/src/main.ts` and `mastracode/src/headless.ts` — TUI/headless MCP initialization timing.
- `mastracode/src/agents/tools.ts` — merges connected MCP tools into the runtime tool map.

## Dependencies / related features

- [MCP status and reload command](./mcp-status-command.md) — UI for status/reload/reconnect and skipped-server display.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — MCP tools join the same runtime/permission surface.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — local workspace tools are separate from external MCP tools but share the agent tool map.

## Existing tests

- `mastracode/src/mcp/__tests__/config.test.ts` — stdio/http classification, URL validation, OAuth validation, skipped entries, and config validation.
- `mastracode/src/mcp/__tests__/manager.test.ts` — HTTP server defs with URL/requestInit/OAuth provider, transport statuses, init/reload/reconnect, skipped servers, namespaced tools, and failure paths.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/mcp` routing through slash command dispatch.

## Missing tests

- Integration test with a real HTTP/Streamable/SSE MCP test server proving tool calls work end-to-end, not only mocked `MCPClient` definitions.
- TUI `/mcp status` snapshot/assertion showing `[http]` transport and skipped HTTP validation reasons.
- Headless test proving HTTP MCP tools are initialized and available for a headless run.
- OAuth flow test covering token persistence/refresh and failure display for protected HTTP MCP servers.

## Known risks / regressions

- Static `headers` are supported, but dynamic token refresh through headers is not; docs/command copy recommends stdio wrappers for dynamic auth.
- Invalid entries are skipped silently except via `/mcp` status/selector; users may not notice configuration typos until they inspect MCP status.
- OAuth token storage is keyed by project/server/url/redirect/client/scopes; changing any field creates a new token file.
- Current tests mock `@mastra/mcp`, so protocol-level HTTP/SSE compatibility is not proven here.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
