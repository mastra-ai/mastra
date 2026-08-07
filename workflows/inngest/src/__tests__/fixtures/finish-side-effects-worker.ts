import { connect } from '../../connect';
import { buildFinishSideEffectsAgent } from './finish-side-effects-agent';

const dbUrl = process.argv[2];
const agentId = process.argv[3];
const inngestPort = Number(process.argv[4]);

if (!dbUrl || !agentId || !inngestPort) {
  throw new Error('Expected <dbUrl> <agentId> <inngestPort>');
}

const { mastra, inngest } = buildFinishSideEffectsAgent({ dbUrl, agentId, inngestPort });
await connect({ mastra, inngest });
console.log('FINISH_SIDE_EFFECTS_WORKER_READY');

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
