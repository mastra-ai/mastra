# Packed MCP v2 consumer

This consumer installs packed builds of `@mastra/core`, `@mastra/mcp` and `@mastra/server` with strict peers and drives the modern-only server with the independent `@modelcontextprotocol/client` 2.0.0, a legacy `@modelcontextprotocol/sdk` 1.29.0 client (rejection only) and Mastra's own `MCPClient`. It never imports workspace source.

From the repository root, build and pack the three packages, then pass the tarballs and a new consumer directory:

```sh
pnpm build:core
pnpm --filter ./packages/mcp build:lib
pnpm --filter ./packages/server build:lib
pnpm --filter ./packages/core --filter ./packages/mcp --filter ./packages/server pack --pack-destination /tmp/mcp-v2-artifacts
bash packages/mcp/integration-tests/modern-v2/run.sh /tmp/mcp-v2-artifacts/mastra-core-<v>.tgz /tmp/mcp-v2-artifacts/mastra-mcp-<v>.tgz /tmp/mcp-v2-artifacts/mastra-server-<v>.tgz /tmp/mcp-v2-consumer
```

The runner checks the packed export inventory (removed surfaces absent, modern ones present), typechecks, then runs an isolated HTTP server on an assigned port and a stdio server as a child process. It closes its own clients, servers and processes.

Assertions cover the core registry union, ordinary `createTool` execution without a legacy context, two keyed `input_required` rounds with signed `requestState` and one counted write, per-request log opt-in and severity filtering, tampered-state rejection, absence of `initialize`/`ping`/session headers/`logging/setLevel`/legacy resource subscriptions/SSE GET streams on the wire, explicit rejection of legacy peers over HTTP and stdio, and Mastra's `MCPClient` fulfilling keyed input requests. Generated manifests, lockfiles, tarballs and installed packages belong only in the disposable consumer directory.
