/**
 * Connect worker for the deadline test. Runs in its own process with an empty run registry;
 * two of these form the worker pool the Inngest dev server routes step executions to.
 *
 * Usage: tsx deadline-worker.ts <dbUrl> <agentId> <inngestPort> <logDir>
 */
import { connect } from '../../connect';
import { buildDeadlineAgent } from './deadline-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);
const logDir = process.argv[5];

if (!dbUrl || !agentId || !logDir) {
  console.error('[worker] usage: deadline-worker.ts <dbUrl> <agentId> <inngestPort> <logDir>');
  process.exit(1);
}

const { mastra, inngest } = buildDeadlineAgent({ dbUrl, agentId, inngestPort, logDir });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
