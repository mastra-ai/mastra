/**
 * Connect worker for the message-persistence test — runs in a SEPARATE process.
 *
 * With `@mastra/inngest` the durable agentic loop executes here, NOT in the process that called
 * `stream()`. `globalRunRegistry` is process-local, so steps here start with an EMPTY registry —
 * the condition that made finish-time memory persistence silently no-op.
 *
 * Usage: tsx inngest-xproc-worker.ts <dbUrl> <agentId> <inngestPort>
 */
import { connect } from '../../connect';
import { buildXprocTestAgent } from './inngest-xproc-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);

if (!dbUrl || !agentId) {
  console.error('[worker] usage: worker.ts <dbUrl> <agentId> [inngestPort]');
  process.exit(1);
}

const { mastra, inngest } = buildXprocTestAgent({ dbUrl, agentId, inngestPort });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
