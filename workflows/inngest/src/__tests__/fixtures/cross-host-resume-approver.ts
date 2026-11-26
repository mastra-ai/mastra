/**
 * Approves a parked run from a separate process that serves no workflow steps, so the resumed
 * steps run on the host that started the run.
 *
 * Usage: tsx cross-host-resume-approver.ts <dbUrl> <agentId> <inngestPort> <mockUrl> <outDir> <runId>
 */
import { RequestContext } from '@mastra/core/request-context';

import { buildDeadlineCrossWorkerAgent } from './deadline-cross-worker-agent';

const [dbUrl, agentId, inngestPort, mockUrl, outDir, runId] = process.argv.slice(2);
if (!dbUrl || !agentId || !mockUrl || !outDir || !runId) throw new Error('Missing approver arguments');

const { durableAgent } = buildDeadlineCrossWorkerAgent({
  dbUrl,
  agentId,
  inngestPort: Number(inngestPort),
  mockUrl,
  outDir,
  workerName: 'approver',
});

const requestContext = new RequestContext<unknown>([
  ['probe-marker', 'B'],
  ['mastra__user', { id: 'bob' }],
]);
const resume = await durableAgent.resume(runId, { approved: true }, { toolCallId: 'call-approve', requestContext });
for await (const chunk of resume.output.fullStream as AsyncIterable<{ type: string }>) {
  if (chunk.type === 'finish') console.log('[approver] finished');
}
process.exit(0);
