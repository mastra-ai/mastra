/**
 * Peer fixture for run-ownership.test.ts: a replica that starts a default-engine
 * workflow run on the shared LibSQL file and holds its step open until the test
 * process says `finish` (or kills this process).
 */
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createOwnedWorkflow } from './run-ownership-workflow';

runPeer(async peer => {
  const storage = new LibSQLStore({ id: `run-ownership-peer-${process.pid}`, url: peer.dbUrl });
  const workflow = createOwnedWorkflow(async runId => {
    await peer.signal('executing', { runId });
    await peer.waitFor('finish');
  });
  const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });

  const run = await mastra.getWorkflow('workflow').createRun();
  const result = await run.start({ inputData: {} });
  await mastra.shutdown();
  return { status: result.status };
});
