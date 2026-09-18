---
'@mastra/mcp': major
---

Rebuilt `@mastra/mcp` on the MCP 2026-07-28 revision. Servers serve that revision only, and every request is self-contained: there is no `initialize` handshake, session header, `ping`, or standalone HTTP+SSE transport. Streamable HTTP responses still stream as Server-Sent Events. Requires `@mastra/core` 1.68 or newer. The full migration guide is at `/reference/migrations/mcp-v2`.

**Migration.** A tool that needs input from the caller no longer awaits `context.mcp.elicitation.sendRequest()`. It calls `context.suspend(payload)` and returns; the server answers `input_required`, and when the caller replies the tool runs again with `context.resumeData` and `context.suspendPayload`. On the client, `mcp.elicitation.onRequest()` becomes a per-server `inputRequests` handler.

```diff
  execute: async ({ orderId }, context) => {
-   const answer = await context.mcp!.elicitation.sendRequest({ message: 'Address?', requestedSchema });
-   if (answer.action !== 'accept') return { confirmed: false };
-   return { confirmed: await book(orderId, answer.content.address) };
+   if (!context.resumeData) return context.suspend({ phase: 'address' });
+   return { confirmed: await book(orderId, context.resumeData.address) };
  },
```

```diff
- mcp.elicitation.onRequest('returns', async params => askUser(params));
+ const mcp = new MCPClient({
+   servers: { returns: { url, inputRequests: async ({ key, params }) => askUser(key, params) } },
+ });
```

```ts
import { createTool } from '@mastra/core/tools';
import { MCPClient, MCPServer } from '@mastra/mcp';
import { z } from 'zod';

const bookDelivery = createTool({
  id: 'bookDelivery',
  inputSchema: z.object({ orderId: z.string() }),
  suspendSchema: z.object({ phase: z.literal('address') }),
  resumeSchema: z.object({ address: z.string() }),
  outputSchema: z.object({ bookingId: z.string() }),
  execute: async ({ orderId }, context) => {
    if (!context.resumeData) return context.suspend({ phase: 'address' });
    return { bookingId: await book(orderId, context.resumeData.address) };
  },
});

const server = new MCPServer({
  name: 'Returns Desk',
  version: '2.0.0',
  tools: { bookDelivery },
  // Signs the continuation state; share it across every process that may answer a resumed round.
  requestState: { key: process.env.MCP_REQUEST_STATE_KEY! },
});

const client = new MCPClient({
  servers: {
    returns: {
      url: new URL('https://returns.example.com/mcp'),
      // Called once per embedded request per round; return accept, decline or cancel.
      inputRequests: async ({ key, params }) => {
        if (params.mode !== 'form') return { action: 'decline' };
        return { action: 'accept', content: await promptUser(key, params.requestedSchema) };
      },
    },
  },
});
```

The server keeps nothing between rounds: what it needs to resume (method, tool, argument hash, caller, round and your `suspendPayload`) travels in the signed `requestState` the client echoes back, so a tampered, expired or foreign state is rejected before the tool runs. Without `requestState.key` the server signs with a per-process key and a round can only be resumed on the process that started it.

**Also changed**

- `MCPClient` probes each server with `server/discover` and falls back to the legacy handshake unless `protocolVersion` pins `'2026-07-28'` or `'legacy'`; `getServerProtocolVersions()` reports the outcome. Legacy connections keep the shared verbs but not subscriptions, list-changed handlers or input requests.
- `server.executeTool()` and the REST execute route return `{ status: 'suspended', suspendPayload, resumeSchema }` or `{ status: 'completed', output }`, and answer invalid input with an error instead of a completed result.
- `context.mcp` keeps `extra`, `log` and `progress`; `elicitation.sendRequest`, `extra.sendRequest` and `extra.sendNotification` throw on a 2.0 server.
- Log levels are requested per request through the `io.modelcontextprotocol/logLevel` metadata key.
- `resources.subscribe` and `resources.unsubscribe` keep their signatures but ride one `subscriptions/listen` stream per server.
- Tool schemas are advertised and validated as JSON Schema 2020-12, with untrusted schemas bounded to 128 levels and 10,000 nodes.
- Server definitions accept a `traceContext` provider; received W3C trace fields are available to tools as `requestContext.get('traceContext')`.
- `MCPOAuthClientProvider` requires exactly one of `clientInformation` or `clientMetadataUrl` and never registers dynamically.

**Removed:** the server `protocolVersion` option, `startSSE`, `startHonoSSE`, `connectSSE`, `handleServerlessRequest`, `sessionId`, `sessionIds`, `reconnectionOptions`, `eventSourceInit`, `elicitation` actions, `roots`, `sampling`, `logging/setLevel`, `sendLoggingMessage()`, `getServer()`, `resources/subscribe`, `registerClient` and `OAuthClientRegistrationError`.
