---
'@mastra/mcp': minor
---

Added experimental webhook delivery for MCP Events. A server can now POST event occurrences to a URL the client registers, instead of the client polling or holding a stream open. This implements webhook delivery from the draft SEP-3415 extension, so the API and wire format may change.

**Server:** set `eventsOptions.webhook` to serve `events/subscribe` for event types you emit to. Callers must be authenticated. Callback URLs must be public `https` URLs and pass a verification challenge, and every delivery is signed.

```ts
const server = new MCPServer({
  id: 'tickets',
  name: 'Tickets',
  version: '1.0.0',
  tools: {},
  events: { 'ticket.created': defineEvent({ payloadSchema: z.object({ id: z.string() }) }) },
  eventsOptions: { webhook: {} },
});
```

**Client:** set `webhook.url` and route it to `mcp.events.handleWebhook()`. Subscriptions then prefer webhook delivery, verify each signature, and refresh before they expire.

```ts
const mcp = new MCPClient({
  servers: { tickets: { url: new URL('https://tickets.example.com/mcp') } },
  webhook: { url: 'https://agent.example.com/mcp/webhook' },
});

registerApiRoute('/mcp/webhook', {
  method: 'POST',
  requiresAuth: false,
  handler: c => mcp.events.handleWebhook(c.req.raw),
});
```
