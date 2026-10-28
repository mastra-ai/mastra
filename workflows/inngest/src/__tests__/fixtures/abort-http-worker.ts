/**
 * Connect worker for the HTTP run-abort test — runs in a SEPARATE process, like a production
 * worker pool, so the durable loop and the slow tool execute here rather than in the API process.
 *
 * Usage: tsx abort-http-worker.ts <dbUrl> <agentId> <inngestPort> <mockUrl> <outDir>
 */
import { connect } from '../../connect';
import { buildAbortHttpAgent } from './abort-http-agent';

const [dbUrl, agentId, port, mockUrl, outDir] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl || !outDir) throw new Error('Missing worker arguments');

const { mastra, inngest } = buildAbortHttpAgent({ dbUrl, agentId, inngestPort: Number(port), mockUrl, outDir });

await connect({ mastra, inngest });
console.log('[worker] ready');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
