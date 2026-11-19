import { fileURLToPath } from 'node:url';
import { MCPClient } from '../client/configuration.js';

// A real host with two stdio connections and its own asynchronous shutdown (#27478).
const [, , hooks, disconnectFirst, signal = 'SIGTERM'] = process.argv;
const server = {
  command: process.execPath,
  args: ['--import', 'tsx', fileURLToPath(new URL('./noisy-server.ts', import.meta.url))],
  stderr: 'pipe',
} satisfies import('../client/types.js').MastraMCPServerDefinition;

// Which process listeners a client installs, and whether it let go of them again, is only
// observable from inside the host process that owns them (#29547).
const listenerCounts = () => ({
  SIGINT: process.listenerCount('SIGINT'),
  SIGTERM: process.listenerCount('SIGTERM'),
  SIGHUP: process.listenerCount('SIGHUP'),
  beforeExit: process.listenerCount('beforeExit'),
  message: process.listenerCount('message'),
});
const reportListeners = (stage: string) =>
  console.log(`host: listeners ${JSON.stringify({ [stage]: listenerCounts() })}`);

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

// The baseline is taken once the host's own handler exists, so it holds just the listeners the
// host owns and any the clients add stand out.
reportListeners('before');

const { errors } = await mcp.listToolsWithErrors();
if (Object.keys(errors).length) throw new Error(JSON.stringify(errors));
reportListeners('connected');
if (disconnectFirst === 'true') {
  await mcp.disconnect();
  reportListeners('disconnected');
}
console.log('host: READY');
setInterval(() => {}, 1000);
