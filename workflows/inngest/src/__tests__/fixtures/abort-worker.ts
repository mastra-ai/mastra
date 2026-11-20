import { connect } from '../../connect';
import { buildAbortAgent } from './abort-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4]);

if (!dbUrl || !agentId || !inngestPort) {
  throw new Error('Expected <dbUrl> <agentId> <inngestPort>');
}

const { mastra, inngest } = buildAbortAgent({ dbUrl, agentId, inngestPort });
const connection = await connect({ mastra, inngest });
console.log('ABORT_WORKER_READY');

const shutdown = async () => {
  await connection.close();
  await connection.closed;
};

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
