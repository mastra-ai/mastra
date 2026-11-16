import { connect } from '../../connect';
import { buildOmReplacementAgent } from './om-replacement-agent';

const [dbUrl, agentId, port, mockUrl, observationalMemory] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl) throw new Error('Missing worker arguments');
const { mastra, inngest, storage } = buildOmReplacementAgent({
  dbUrl,
  agentId,
  inngestPort: Number(port),
  mockUrl,
  observationalMemory: observationalMemory === 'true',
});
await connect({ mastra, inngest });
console.log('[worker] ready');
process.on('SIGTERM', async () => {
  // Close the pool before exiting so a PostgreSQL-backed worker does not leave
  // connections behind for the next test run.
  await storage.close();
  process.exit(0);
});
