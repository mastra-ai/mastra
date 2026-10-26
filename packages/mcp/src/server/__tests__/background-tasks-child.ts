/**
 * An MCP server process for the restart tests: serves `crashy` as a task from Mastra background
 * tasks on the libsql file given as the first argument. Prints `READY <url>` once listening; the
 * test SIGKILLs it mid-task.
 */
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { MCPServer } from '../server';
import { authFor, makeCrashy } from './background-tasks.mock';
import { serveHTTP } from './harness.mock';

const [url, counterFile, recover] = process.argv.slice(2);

const server = new MCPServer({
  name: 'Tasks',
  version: '1.0.0',
  tools: { crashy: makeCrashy(counterFile!) },
  tasks: { tools: { crashy: { mode: 'always', recover: recover === 'true' } } },
});
const mastra = new Mastra({
  logger: false,
  storage: new LibSQLStore({ id: 'tasks', url: url! }),
  backgroundTasks: { enabled: true, leaseDurationMs: 3_000 },
  mcpServers: { tasks: server },
});
void mastra;
const served = await serveHTTP(server, { auth: req => authFor(String(req.headers['x-test-user'] ?? 'alice')) });
process.stdout.write(`READY ${served.url.href}\n`);
