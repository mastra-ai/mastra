---
'@mastra/mcp': major
---

Rebuilt `@mastra/mcp` on the MCP 2026-07-28 revision. Servers serve that revision only, and every request is self-contained: there is no `initialize` handshake, session header, `ping`, or standalone HTTP+SSE transport. Streamable HTTP responses still stream as Server-Sent Events. Requires `@mastra/core` 1.68 or newer.

**Suspend and resume instead of server-initiated elicitation.** A tool that needs input from the caller calls `context.suspend(payload)`; the server returns `input_required` with a signed `requestState`, and when the caller answers, the tool runs again with `context.resumeData` (validated against `resumeSchema`) and `context.suspendPayload`. The same `createTool` definition works for agents, workflows and MCP. Resource and prompt callbacks receive `suspend`, `resumeData` and `suspendPayload` too. `context.mcp` keeps `extra`, `log` and `progress`; `elicitation.sendRequest`, `extra.sendRequest` and `extra.sendNotification` throw on a 2.0 server. `server.executeTool()` and the REST execute route report `{ status: 'suspended', suspendPayload, resumeSchema }` for a suspended tool and `{ status: 'completed', output }` otherwise. Configure `requestState: { key, ttlSeconds }` so every instance can verify a continuation.

**Client negotiation.** `MCPClient` speaks 2026-07-28 and by default probes each server with `server/discover`, falling back to the legacy `initialize` handshake for servers that have not upgraded. Per-server `protocolVersion` pins `'2026-07-28'` (fail on legacy servers) or `'legacy'` (skip the probe); `getServerProtocolVersions()` reports what was negotiated. On a legacy connection the shared verbs work while `subscriptions.listen` and embedded input requests throw. Clients answer `input_required` through the new per-server `inputRequests` handler; `elicitation.onRequest()` is removed.

**Logging.** Log levels are requested per request through the `io.modelcontextprotocol/logLevel` metadata key (the client sends it when `enableServerLogs` is on, at `serverLogLevel`); `logging/setLevel`, `sendLoggingMessage()` and `getServer()` are removed.

**Subscriptions.** `resources/subscribe` and `resources/unsubscribe` are replaced by `mcp.subscriptions.listen(serverName, filter)`, which delivers list-changed and resource-updated notifications on one stream.

**Auth.** `MCPOAuthClientProvider` requires a pre-registered `clientInformation` or a `clientMetadataUrl` (Client ID Metadata Document) and never performs dynamic client registration; `registerClient` and `OAuthClientRegistrationError` are no longer exported.

**Removed options and surfaces:** the server `protocolVersion` option, `connectSSE`, `handleServerlessRequest`, `sessionId`, `sessionIds`, `reconnectionOptions`, `eventSourceInit`, the `roots` option with `setRoots()` / `sendRootsListChanged()`, `MastraPrompt` (use `Prompt`), and the session/serverless flags of `startHTTP`. `startSSE` and `startHonoSSE` stay on the shared `MCPServerBase` for 1.x servers and reject on a 2.0 server. `MCPServer` and `MCPClientServerProxy` set `mcpVersion` to `2` so registries can tell the two apart without a separate base class.

`@mastra/mcp` 1.x remains the path for serving clients that have not adopted 2026-07-28 and keeps working with current `@mastra/core`. See the migration guide at `/reference/migrations/mcp-v2` for before-and-after examples.
