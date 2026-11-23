/**
 * A worker process that tries to start the next occurrence of a step with a
 * step guard, on the LibSQL file the test process shares. It waits for `go`
 * so both peers try at the same time, and reports whether its start won.
 */
import { WorkflowStepConflictError } from '@mastra/core/storage';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';

export interface GuardedStartArgs {
  storageVersion: 1 | 2;
  workflowName: string;
  runId: string;
  stepId: string;
  eventId: string;
  expectedStartedBy: string;
}

export type GuardedStartResult = { won: true } | { won: false; conflict: true; reason: string };

runPeer<GuardedStartArgs>(async peer => {
  const { storageVersion, workflowName, runId, stepId, eventId, expectedStartedBy } = peer.args;
  const storage = new LibSQLStore({ id: `guarded-start-${peer.config.role}`, url: peer.dbUrl });
  try {
    await storage.init();
    const workflows = (await storage.getStore('workflows'))!;
    const result = { status: 'running' as const, startedAt: 1, payload: {}, metadata: { startedBy: eventId } };
    const startGuard = { eventId, expectedStartedBy };
    const requestContext = { startedBy: eventId };
    await peer.signal('ready');
    await peer.waitFor('go');
    await peer.signal('starting');
    try {
      if (storageVersion === 1) {
        await workflows.updateWorkflowResults({ workflowName, runId, stepId, result, requestContext, startGuard });
      } else {
        await workflows.appendWorkflowRunEntries({
          workflowName,
          runId,
          steps: { [stepId]: result },
          requestContext,
          startGuard,
        });
      }
      return { won: true } satisfies GuardedStartResult;
    } catch (error) {
      if (!(error instanceof WorkflowStepConflictError)) throw error;
      return { won: false, conflict: true, reason: error.reason } satisfies GuardedStartResult;
    }
  } finally {
    await storage.close();
  }
});
