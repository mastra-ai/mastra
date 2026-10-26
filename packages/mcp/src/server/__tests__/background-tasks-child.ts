/**
 * An MCP server process for the tests that kill a server: serves `crashy`, `approve` and `hang` as
 * tasks from Mastra background tasks on the libsql file given as the first argument, with one slot
 * when `oneSlot` is passed, and `crashy` in mode `auto` when that is passed. Prints `READY <url>` once listening; the test SIGKILLs it mid-task.
 */
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { MCPServer } from '../server';
import { authFor, makeApprove, makeCrashy, makeHang } from './background-tasks.mock';
import { serveHTTP } from './harness.mock';

const [url, counterFile, recover, slots, mode] = process.argv.slice(2);

const server = new MCPServer({
  name: 'Tasks',
  version: '1.0.0',
  tools: { crashy: makeCrashy(counterFile!), approve: makeApprove(), hang: makeHang() },
  tasks: {
    default: 'always',
    tools: { crashy: { mode: mode === 'auto' ? 'auto' : 'always', syncWindowMs: 50, recover: recover === 'true' } },
  },
});
const mastra = new Mastra({
  logger: false,
  storage: new LibSQLStore({ id: 'tasks', url: url! }),
  backgroundTasks: {
    enabled: true,
    leaseDurationMs: 3_000,
    ...(slots === 'oneSlot' && { perOwnerConcurrency: { 'mcp-server:tasks': 1 } }),
  },
  mcpServers: { tasks: server },
});
void mastra;
const served = await serveHTTP(server, { auth: req => authFor(String(req.headers['x-test-user'] ?? 'alice')) });
process.stdout.write(`READY ${served.url.href}\n`);
