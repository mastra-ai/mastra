/**
 * Connect worker for the span-outcome test. Runs in its own process with an empty run registry;
 * several of these form the worker pool the Inngest dev server routes step executions to.
 *
 * Usage: tsx span-outcome-worker.ts <dbUrl> <agentId> <inngestPort>
 */
import { connect } from '../../connect';
import { buildSpanOutcomeAgent } from './span-outcome-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);

if (!dbUrl || !agentId) {
  console.error('[worker] usage: span-outcome-worker.ts <dbUrl> <agentId> <inngestPort>');
  process.exit(1);
}

const { mastra, inngest } = buildSpanOutcomeAgent({ dbUrl, agentId, inngestPort });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
