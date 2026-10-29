import { connect } from '../../connect';
import { buildOmReplacementAgent } from './om-replacement-agent';

const [dbUrl, agentId, port, mockUrl, observationalMemory] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl) throw new Error('Missing worker arguments');
const { mastra, inngest } = buildOmReplacementAgent({
  dbUrl,
  agentId,
  inngestPort: Number(port),
  mockUrl,
  observationalMemory: observationalMemory === 'true',
});
await connect({ mastra, inngest });
console.log('[worker] ready');
process.on('SIGTERM', () => process.exit(0));
