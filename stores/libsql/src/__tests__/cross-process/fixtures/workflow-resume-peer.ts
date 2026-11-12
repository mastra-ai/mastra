import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createApprovalWorkflow, createResumeTracingObservability } from './approval-workflow';

export interface WorkflowResumePeerArgs {
  workflowId: string;
}

/** A worker that runs the evented workflow's steps, including the suspend that writes the snapshot. */
runPeer<WorkflowResumePeerArgs>(async peer => {
  const { workflowId } = peer.args;
  const storage = new LibSQLStore({ id: 'workflow-resume-worker', url: peer.dbUrl });
  const mastra = new Mastra({
    workflows: { [workflowId]: createApprovalWorkflow(workflowId) },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: peer.workers ? undefined : false,
    observability: createResumeTracingObservability(),
  });
  try {
    await bootWorkers(mastra, peer.workers);
    await peer.signal('worker-ready');
    await peer.waitFor('finish');
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
