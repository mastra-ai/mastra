# Packed MCP v2 consumer

This consumer installs packed builds of `@mastra/core`, `@mastra/mcp` and `@mastra/server` with strict peers and drives the 2026-07-28-only server with the independent `@modelcontextprotocol/client` 2.0.0, a legacy `@modelcontextprotocol/sdk` 1.29.0 client (rejection only) and Mastra's own `MCPClient`. It never imports workspace source.

From the repository root, build and pack the three packages, then pass the tarballs and a new consumer directory:

```sh
pnpm build:core
pnpm --filter ./packages/mcp build:lib
pnpm --filter ./packages/server build:lib
pnpm --filter ./packages/core --filter ./packages/mcp --filter ./packages/server pack --pack-destination /tmp/mcp-v2-artifacts
bash packages/mcp/integration-tests/v2/run.sh /tmp/mcp-v2-artifacts/mastra-core-<v>.tgz /tmp/mcp-v2-artifacts/mastra-mcp-<v>.tgz /tmp/mcp-v2-artifacts/mastra-server-<v>.tgz /tmp/mcp-v2-consumer
```

The runner checks the packed export inventory (removed surfaces absent, `startSSE`/`startHonoSSE` rejecting on a 2.x server, current ones present), typechecks, then runs an isolated HTTP server on an assigned port and a stdio server as a child process. It closes its own clients, servers and processes.

Assertions cover registration on the shared `MCPServerBase` with `mcpVersion` 2, `executeTool` reporting a suspension separately from a completed result, ordinary `createTool` execution with a 2026-07-28 `context.mcp` whose deprecated members throw, two `suspend`/`resumeData` rounds carried as `input_required` with signed `requestState` and one counted write, per-request log opt-in and severity filtering, tampered-state rejection, absence of `initialize`/`ping`/session headers/`logging/setLevel`/legacy resource subscriptions/SSE GET streams on the wire, explicit rejection of legacy peers over HTTP and stdio, and Mastra's `MCPClient` answering input requests through its `inputRequests` handler. Generated manifests, lockfiles, tarballs and installed packages belong only in the disposable consumer directory.
