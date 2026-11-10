import { connect } from '../../connect';
import { buildThreadLeaseAgent } from './thread-lease-agent';

const [dbUrl, agentId, inngestPort, socketPath, logPath] = process.argv.slice(2);

if (!dbUrl || !agentId || !inngestPort || !socketPath || !logPath) {
  throw new Error('Expected <dbUrl> <agentId> <inngestPort> <socketPath> <logPath>');
}

const { mastra, inngest } = buildThreadLeaseAgent({
  dbUrl,
  agentId,
  inngestPort: Number(inngestPort),
  socketPath,
  logPath,
});
const connection = await connect({ mastra, inngest });
console.log('THREAD_LEASE_WORKER_READY');

const shutdown = async () => {
  await connection.close();
  await connection.closed;
};

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
