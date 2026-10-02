# Studio MCP App

A small React entry point that reuses `@mastra/playground-ui` to display Studio's connection form and trace list in an MCP Apps iframe. Public servers only: no user-configurable request headers, cookies, login flow, sidebar, or trace details.

## Build and test

From the repository root:

```sh
pnpm install
pnpm build:server
pnpm --filter @internal/studio-mcp-app typecheck
pnpm --filter @internal/studio-mcp-app test
pnpm --filter @mastra/server test src/server/handlers/studio.test.ts
```

The server build builds this package and embeds its HTML string. `@internal/studio-mcp-app` is private and isn't required at runtime. Route generation has explicit dependencies to avoid a cycle through the client SDK's generated types.

For a standalone UI development preview, start a public local Mastra server at `http://localhost:4111`, then run:

```sh
pnpm --filter @internal/studio-mcp-app dev
```

The development HTML defaults to that server. Its `localPreview` configuration permits other loopback hosts and ports, so you can enter `http://localhost:4112` in the connection form. Enter the base URL, without `/api` or `/api/studio/mcp`. The target server must allow the preview's origin through CORS. An iframe development host must also allow loopback connections in its CSP.

The deployed MCP resource instead receives the public URL and API prefix from Mastra Server. It never enables `localPreview` and continues to restrict connections to its own origin.

## Connect a host

Use `https://your-server.example/api/studio/mcp` as the remote MCP endpoint. It advertises `open_studio` with a ChatGPT global entry point and a versioned `ui://mastra-studio/traces-….html` resource. The UI uses the standard MCP Apps handshake and host theme. It calls the existing observability API with `@mastra/client-js`; traces stay out of the launch tool's result.

The HTML contains all application JavaScript and CSS. Its CSP permits network access only to the endpoint's own public origin. To use another host, connect that server's MCP endpoint. For HTTPS termination or proxy mounts, set `MASTRA_STUDIO_PUBLIC_URL` to the external base URL, excluding the API prefix.

For development through a `*.ngrok-free.app` tunnel, API requests include ngrok's documented `ngrok-skip-browser-warning` header so the browser receives JSON instead of the free-tier interstitial. Other server hosts receive no tunnel header. This does not add authentication; the server must still be public and allow the UI origin through CORS.

Each connection has its own React Query cache. Column preferences use Studio's existing per-server storage key. Changing servers unmounts the queries; no credentials are persisted or forwarded. The list uses the trace-query API when supported and Studio's legacy lightweight API otherwise.

Deploying a server with this feature makes the MCP App available automatically. It does not publish or install a ChatGPT plugin. A public deployment and host connection are still needed to test in ChatGPT itself.
