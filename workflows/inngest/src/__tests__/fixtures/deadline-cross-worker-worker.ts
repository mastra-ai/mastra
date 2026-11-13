/**
 * serve() worker for the cross-worker deadline test. Two of these run as SEPARATE processes behind
 * a round-robin proxy, so consecutive steps of one run land on different workers, and neither
 * worker is the process that called `stream()`.
 *
 * Usage: tsx deadline-cross-worker-worker.ts <dbUrl> <agentId> <inngestPort> <mockUrl> <outDir> <port> <workerName>
 */
import { serve as honoServe } from '@hono/node-server';
import { Hono } from 'hono';

import { serve as inngestServe } from '../../index';
import { buildDeadlineCrossWorkerAgent } from './deadline-cross-worker-agent';

const [dbUrl, agentId, inngestPort, mockUrl, outDir, port, workerName] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl || !outDir || !port || !workerName) throw new Error('Missing worker arguments');

const { mastra, inngest } = buildDeadlineCrossWorkerAgent({
  dbUrl,
  agentId,
  inngestPort: Number(inngestPort),
  mockUrl,
  outDir,
  workerName,
});

const handler = inngestServe({ mastra, inngest });
const app = new Hono();
app.on(['GET', 'POST', 'PUT'], '/inngest/api', c => handler(c));
honoServe({ fetch: app.fetch, port: Number(port) }, () => console.log('[worker] ready'));

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
