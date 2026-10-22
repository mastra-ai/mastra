# MCP Events

Subscribe to events from a Mastra `MCPServer` and start an agent run for each occurrence.

> MCP Events implement [SEP-3415](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3415), a draft MCP extension. The API is experimental and may change in any release.

## What it shows

- `src/server.ts`: A stdio `MCPServer` with a `ticket.created` event type. Its `openTicket` tool emits an occurrence with `server.events.emit()`, and `match` routes each occurrence to subscribers whose `project` argument matches.
- `src/client.ts`: An `MCPClient` that starts the server, lists its event types, and subscribes to `ticket.created` for the `web` project. It opens three tickets through the server's tool, then starts a triage agent run for each `web` ticket it receives. The `api` ticket never reaches it. The client logs the subscription cursor after each occurrence, which you'd persist to resume later.

## Run it

Install the dependencies. The example links `@mastra/core` and `@mastra/mcp` from this repository, so build them first (`pnpm turbo build --filter @mastra/mcp` from the repository root):

```bash
cd examples/mcp-events
pnpm install --ignore-workspace
```

Set your OpenAI API key and start the client:

```bash
export OPENAI_API_KEY=sk-...
pnpm start
```

The output looks like this:

```text
Server offers 'ticket.created' via push, poll
Subscribed via push
[T-1] High: checkout is broken for Safari users, which blocks purchases.
cursor: ...
[T-3] Low: a typo doesn't affect functionality.
cursor: ...
```

Read the [MCP events guide](https://mastra.ai/docs/guides/mcp-events) for delivery modes, cursors, and limits. This example uses stdio, so it subscribes with push. To have a remote server POST occurrences to your app instead, see [Webhook delivery](https://mastra.ai/docs/guides/mcp-events#webhook-delivery).
