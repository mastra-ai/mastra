/**
 * Connect worker for the suspend-metadata test — runs in a SEPARATE process.
 *
 * This separation is the entire point: with `@mastra/inngest` the durable agentic loop executes on
 * the connect worker, NOT in the process that called `stream()`. `globalRunRegistry` is an
 * in-memory, process-local cache, so steps running here start with an EMPTY registry — the
 * condition an in-process (serve-mode) test can never reproduce.
 *
 * Usage: tsx suspend-metadata-worker.ts <dbUrl> <agentId> <inngestPort>
 */
import { connect } from '../../connect';
import { buildSuspendMetaAgent } from './suspend-metadata-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);

if (!dbUrl || !agentId) {
  console.error('[worker] usage: worker.ts <dbUrl> <agentId> [inngestPort]');
  process.exit(1);
}

const { mastra, inngest } = buildSuspendMetaAgent({ dbUrl, agentId, inngestPort });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
