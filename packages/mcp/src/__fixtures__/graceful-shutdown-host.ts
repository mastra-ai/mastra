import { fileURLToPath } from 'node:url';
import { MCPClient } from '../client/configuration.js';

// A real host with two stdio connections and its own asynchronous shutdown (#27478).
const [, , hooks, disconnectFirst, signal = 'SIGTERM'] = process.argv;
const server = {
  command: process.execPath,
  args: ['--import', 'tsx', fileURLToPath(new URL('./noisy-server.ts', import.meta.url))],
  stderr: 'pipe',
} satisfies import('../client/types.js').MastraMCPServerDefinition;
const mcp = new MCPClient({
  servers: { first: server, second: server },
  ...(hooks === 'default' ? {} : { registerProcessHooks: hooks === 'true' }),
});

process.once(signal, async () => {
  console.log('host: starting cleanup');
  await mcp.disconnect();
  // Models awaited host work (for example, draining requests) after MCP teardown.
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('host: cleanup finished');
  process.exit(0);
});

const { errors } = await mcp.listToolsWithErrors();
if (Object.keys(errors).length) throw new Error(JSON.stringify(errors));
if (disconnectFirst === 'true') await mcp.disconnect();
console.log('host: READY');
setInterval(() => {}, 1000);
