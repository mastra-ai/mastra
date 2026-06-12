# MCP server configuration

## Origin PR / commit

- PR: [#13613](https://github.com/mastra-ai/mastra/pull/13613) — added HTTP MCP server config support, headers, OAuth metadata, and transport-aware manager status.
- Related origin: [#13311](https://github.com/mastra-ai/mastra/pull/13311) — made `/mcp` status/reload use the live MCP manager; [#13347](https://github.com/mastra-ai/mastra/pull/13347) — refactored manager into `createMcpManager()`.
- Later changes: [#13750](https://github.com/mastra-ai/mastra/pull/13750) — adds `createMastraCode({ mcpServers })` for programmatic MCP server configs that override file-based servers and persist across reloads; [#14377](https://github.com/mastra-ai/mastra/pull/14377) — adds background initialization summaries, per-server reconnect/log state, and an interactive `/mcp` selector for configured/skipped servers; [#14960](https://github.com/mastra-ai/mastra/pull/14960) — sets the MCP client timeout to seven days so long-running MCP tools are not killed by a short default result timeout; [#16548](https://github.com/mastra-ai/mastra/pull/16548) — wires protected HTTP MCP OAuth config into `MCPOAuthClientProvider` with per-project/server token storage; [#13751](https://github.com/mastra-ai/mastra/pull/13751) — lets `createMastraCode({ configDir })` move Mastra Code MCP config lookup away from `.mastracode`.

## User-visible behavior

- What the user can do: configure MCP servers in `.mastracode/mcp.json` (or the configured Mastra Code config directory), global `~/.mastracode/mcp.json`, Claude-compatible `.claude/settings.local.json`, or programmatically via `createMastraCode({ mcpServers })`, using either stdio `command` entries or HTTP `url` entries, including protected HTTP servers with OAuth metadata.
- Success looks like: valid stdio and HTTP MCP servers initialize in the background, protected HTTP servers get an MCP OAuth provider with durable per-server token storage, expose namespaced tools, show transport (`stdio`/`http`) and skipped reasons in `/mcp status`/selector, can be reloaded or individually reconnected, and allow long-running MCP tool calls to complete.
- Must preserve: programmatic servers override file-based servers by name, project config overrides global config by server name, global overrides Claude config, skipped lower-priority entries disappear when a valid higher-priority server exists, programmatic servers survive reload, MCP client timeout stays intentionally long rather than reverting to a short default, and HTTP OAuth redirect URLs remain HTTPS except loopback HTTP.

## Entry points / commands

- Commands / shortcuts / flags: `/mcp`, `/mcp status`, `/mcp reload`; configuration files under project/global/Claude paths; programmatic `createMastraCode({ mcpServers })`.
- Automatic triggers: `createMcpManager(projectDir, configDir, extraServers)` loads merged file config plus programmatic overrides at startup; TUI initializes MCP in the background after UI start and reports failed/skipped servers; headless initializes MCP for tool availability.

## TUI states

- Idle: `/mcp` shows setup instructions when no configured or skipped servers exist, including stdio and HTTP examples.
- Modal: `/mcp` selector displays configured and skipped servers, transport, tool counts, errors, stderr logs, and per-server reconnect actions.
- Active / error: `/mcp status` displays transport and skipped reasons; background init/reload/reconnect actions update server statuses from the manager and insert failure notices.

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
| Project MCP config | `<project>/<configDir>/mcp.json` (default `.mastracode`) | config loader, `/mcp` setup display |
| Global MCP config | `~/<configDir>/mcp.json` (default `.mastracode`) | config loader, `/mcp` setup display |
| Claude-compatible config | `<project>/.claude/settings.local.json` `mcpServers` | config loader lowest-priority source |
| Merged server map | `loadMcpConfig()` / `mergeConfigs()` plus `extraServers` from `createMastraCode({ mcpServers })` | `createMcpManager()` |
| Programmatic MCP servers | `MastraCodeConfig.mcpServers` | startup MCP manager, reload merge, `/mcp` status/tools |
| Skipped servers | config validation result | `/mcp status`, selector, init summary |
| Runtime statuses/tools/logs | `McpManager` closure state (`serverStatuses`, `tools`, `stderrLogs`, transient `connecting`) plus `MCPClient` timeout (`MASTRACODE_MCP_TIMEOUT_MS = 7 days`) | `/mcp` selector/status, dynamic tools, cleanup, long-running MCP tool calls |
| HTTP OAuth tokens | app-data `mcp-oauth/<fingerprint>.json`, fingerprinted by project dir + server name + URL + redirect/client/scopes | `MCPOAuthClientProvider` and protected HTTP MCP servers |

## Key files

- `mastracode/src/mcp/config.ts` — config path loading with configDir support, stdio/http classification, OAuth validation (HTTPS or loopback redirect URLs, scopes, optional client credentials), merge precedence, skipped-entry tracking.
- `mastracode/src/mcp/types.ts` — stdio/http/OAuth/skipped/status types and `transport` field.
- `mastracode/src/mcp/manager.ts` — server definition building, `MCPClient` construction with seven-day timeout, programmatic `extraServers` merge/override/reload behavior, HTTP URL/request headers/OAuth provider, per-server `FileOAuthStorage`, status/tool/log lifecycle, `initInBackground()`, and `reconnectServer()`.
- `mastracode/src/index.ts` — `MastraCodeConfig.mcpServers` and `createMcpManager(project.rootPath, configDir, config?.mcpServers)` wiring.
- `mastracode/src/tui/commands/mcp.ts` — `/mcp` setup examples, text status, reload/reconnect selector integration.
- `mastracode/src/tui/components/mcp-selector.ts` — interactive management UI for configured and skipped servers.
- `mastracode/src/main.ts`, `mastracode/src/headless.ts`, and `mastracode/src/tui/mastra-tui.ts` — TUI/headless/background MCP initialization timing.
- `mastracode/src/agents/tools.ts` — merges connected MCP tools into the runtime tool map.
- `packages/mcp/src/client/client.ts` and `packages/mcp/src/client/configuration.ts` — upstream MCP client transport/config support consumed by Mastra Code's HTTP MCP manager path.

## Dependencies / related features

- [MCP status and reload command](./mcp-status-command.md) — UI for status/reload/reconnect and skipped-server display.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — MCP tools join the same runtime/permission surface.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — local workspace tools are separate from external MCP tools but share the agent tool map.

## Existing tests

- `mastracode/src/mcp/__tests__/config.test.ts` — stdio/http classification, URL validation, HTTP MCP OAuth validation (loopback/HTTPS redirect URLs, scopes, client credentials), skipped entries, and config validation.
- `mastracode/src/mcp/__tests__/manager.test.ts` — HTTP server defs with URL/requestInit/OAuth provider, per-project/server OAuth storage fingerprinting, transport statuses, init/reload/reconnect, skipped servers, namespaced tools, failure paths, long MCP timeout handoff, and programmatic `extraServers` merge/override/reload behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/mcp` routing through slash command dispatch.
- `mastracode/src/__tests__/index.test.ts` — `createMastraCode({ mcpServers })` startup wiring passes programmatic stdio/HTTP servers to `createMcpManager()` with the detected project root and configured `configDir`.
- `mastracode/scripts/mc-e2e/scenarios/mcp-server-config.ts` — partial real PTY coverage for programmatic stdio `mcpServers`: launches the TUI with a configured failing stdio server, verifies background MCP initialization reports the configured server, and verifies `/mcp status` renders `e2e_stdio_config [stdio]`.
- `mastracode/scripts/mc-e2e/scenarios/mcp-http-tool-call.ts` — real PTY + AIMock coverage for programmatic HTTP MCP config: launches a local Streamable HTTP MCP server, requires configured request headers, verifies `/mcp status` renders `e2e_http_mcp [http]`, and invokes the namespaced `e2e_http_mcp_lookup_status` tool through the model/tool loop.

## Missing tests

- TUI `/mcp status` snapshot/assertion for skipped HTTP validation reasons.
- Headless test proving HTTP MCP tools are initialized and available for a headless run.
- OAuth flow test covering a real protected HTTP MCP server's token persistence/refresh callback behavior and failure display; current coverage verifies config/provider/storage construction through mocks.

## Known risks / regressions

- Static `headers` are supported, but dynamic token refresh through headers is not; docs/command copy recommends stdio wrappers for dynamic auth.
- Programmatic configs have highest priority; a typo or duplicate server name can intentionally shadow a working file-based server.
- Invalid entries are skipped silently except via `/mcp` status/selector; users may not notice configuration typos until they inspect MCP status.
- OAuth token storage is keyed by project/server/url/redirect/client/scopes; changing any field creates a new token file.
- Most lower-level tests mock `@mastra/mcp`; `mcp-http-tool-call` now covers one real Streamable HTTP tool call, but OAuth, headless, skipped-validation, and long-running real MCP calls remain unproven.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
