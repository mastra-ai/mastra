#!/usr/bin/env bash
# Installs packed @mastra/core, @mastra/mcp and @mastra/server into a clean consumer
# with strict peers (no overrides, no source aliases) and runs the modern-only proof.
set -euo pipefail
core=$(realpath "${1:?Pass a packed core tarball}")
mcp=$(realpath "${2:?Pass a packed mcp tarball}")
server=$(realpath "${3:?Pass a packed server tarball}")
consumer=${4:?Pass a new consumer directory}
test -f "$core" && test -f "$mcp" && test -f "$server"
test ! -e "$consumer"
mkdir -p "$consumer"
fixture=$(cd "$(dirname "$0")" && pwd)
cp "$fixture/package.json" "$fixture/tsconfig.json" "$fixture/demo.ts" "$fixture/shared.ts" "$fixture/stdio-server.ts" "$consumer/"
cd "$consumer"
pnpm add "@mastra/core@file:$core" "@mastra/mcp@file:$mcp" "@mastra/server@file:$server" \
  --ignore-workspace --strict-peer-dependencies
node --input-type=module -e '
import assert from "node:assert/strict";
const mcp = await import("@mastra/mcp");
for (const name of ["MCPServer", "MCPClient", "MCPOAuthClientProvider", "MCP_PROTOCOL_VERSION", "MCP_CLIENT_PROTOCOL_VERSION"]) assert.ok(name in mcp, name);
for (const name of ["registerClient", "OAuthClientRegistrationError", "MastraPrompt", "ElicitationHandler"]) assert.ok(!(name in mcp), `${name} must not be exported`);
const proto = mcp.MCPServer.prototype;
for (const name of ["connectSSE", "handleServerlessRequest", "sendLoggingMessage", "getServer"]) assert.ok(!(name in proto), `MCPServer.${name} must not exist`);
for (const name of ["startHTTP", "startStdio", "close", "getToolListInfo", "listResources", "readResource"]) assert.equal(typeof proto[name], "function", name);
// The standalone HTTP+SSE transport is kept on the shared core base for 1.x adapters; a 2.x server rejects it.
const server = new mcp.MCPServer({ name: "inventory", version: "2.0.0", tools: {} });
assert.equal(server.mcpVersion, 2);
for (const name of ["startSSE", "startHonoSSE"]) await assert.rejects(server[name]({}), /2026-07-28|not available|startHTTP/);
const handlers = await import("@mastra/server/handlers/mcp");
assert.ok(handlers.EXECUTE_MCP_SERVER_TOOL_ROUTE);
console.log("PACKED EXPORT INVENTORY PASS");
'
pnpm exec tsc --noEmit
pnpm demo
