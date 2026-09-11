---
'@mastra/mcp': major
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/client-js': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
---

Rebuilt `@mastra/mcp` on the MCP 2026-07-28 revision only. Servers and clients no longer negotiate older protocol revisions, and every request is self-contained: there is no `initialize` handshake, session header, `ping`, or standalone HTTP+SSE transport. Streamable HTTP responses still stream as Server-Sent Events.

**Native input rounds.** Tools, resources and prompts that need input from the caller return `input_required` instead of awaiting a server-initiated elicitation. Write protocol-aware tools with `createMCPTool` from `@mastra/core/mcp`; ordinary `createTool` definitions keep working and no longer receive `context.mcp`. Clients answer input requests through the new per-server `inputRequests` handler; `elicitation.sendRequest()` and `elicitation.onRequest()` are removed. Resource and prompt callbacks receive `{ request, requestContext }` instead of `{ extra }` and can return a continuation too.

**Logging.** Log levels are requested per request through the `io.modelcontextprotocol/logLevel` metadata key (the client sends it when `enableServerLogs` is on, at `serverLogLevel`); `logging/setLevel`, `sendLoggingMessage()` and `getServer()` are removed.

**Subscriptions.** `resources/subscribe` and `resources/unsubscribe` are replaced by `mcp.subscriptions.listen(serverName, filter)`, which delivers list-changed and resource-updated notifications on one stream.

**Auth.** `MCPOAuthClientProvider` requires a pre-registered `clientInformation` or a `clientMetadataUrl` (Client ID Metadata Document) and never performs dynamic client registration; `registerClient` and `OAuthClientRegistrationError` are no longer exported.

**Removed options and surfaces:** `protocolVersion`, `startSSE`, `startHonoSSE`, `connectSSE`, `handleServerlessRequest`, `sessionId`, `sessionIds`, `reconnectionOptions`, `eventSourceInit`, the `roots` option with `setRoots()` / `sendRootsListChanged()`, `MastraPrompt` (use `Prompt`), and the session/serverless flags of `startHTTP`. `MCPServer` and `MCPClientServerProxy` now extend `MCPServerBaseV2`, so `@mastra/core` 1.67 or newer is required; narrow registry entries with `isMCPServerV2()`.

`@mastra/mcp` 1.x remains the path for serving clients that have not adopted 2026-07-28 and keeps working with current `@mastra/core`. See the migration guide at `/reference/migrations/mcp-v2` for before-and-after examples.
