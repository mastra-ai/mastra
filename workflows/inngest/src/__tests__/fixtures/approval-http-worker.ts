/**
 * Connect worker for the HTTP tool-approval test — runs in a SEPARATE process, like a production
 * worker pool, so the durable loop and the approved tool execute here rather than in the API process.
 *
 * Usage: tsx approval-http-worker.ts <dbUrl> <agentId> <inngestPort> <outDir>
 */
import { connect } from '../../connect';
import { buildApprovalHttpAgent } from './approval-http-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);
const outDir = process.argv[5];

if (!dbUrl || !agentId || !outDir) {
  console.error('[worker] usage: worker.ts <dbUrl> <agentId> <inngestPort> <outDir>');
  process.exit(1);
}

const { mastra, inngest } = buildApprovalHttpAgent({ dbUrl, agentId, inngestPort, outDir });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
