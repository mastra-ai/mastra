/**
 * Connect worker for the input-processor requestContext test (#23904) — runs in a SEPARATE process.
 *
 * The durable loop (and its tool call) execute here, not in the process that called stream(). This
 * worker's globalRunRegistry starts empty, so the tool's requestContext is rebuilt from the
 * serialized workflow input — the exact condition an in-process (serve-mode) test can't reproduce.
 *
 * Usage: tsx processor-context-worker.ts <dbUrl> <agentId> <inngestPort> <outDir>
 */
import { connect } from '../../connect';
import { buildProcessorContextAgent } from './processor-context-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4] ?? 4100);
const outDir = process.argv[5];

if (!dbUrl || !agentId || !outDir) {
  console.error('[worker] usage: worker.ts <dbUrl> <agentId> <inngestPort> <outDir>');
  process.exit(1);
}

const { mastra, inngest } = buildProcessorContextAgent({ dbUrl, agentId, inngestPort, outDir });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
