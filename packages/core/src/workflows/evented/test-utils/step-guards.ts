import type { InMemoryStore } from '../../../storage/mock';
import { assertWorkflowStepGuard } from '../../../storage/workflow-step-guard';

/** Enforce step guards on the in-memory store the way guard-capable adapters (pg) do. */
export async function withStepGuards(storage: InMemoryStore) {
  const workflows = (await storage.getStore('workflows'))!;
  const update = workflows.updateWorkflowResults.bind(workflows);
  let lock: Promise<unknown> = Promise.resolve();
  workflows.supportsWorkflowStepGuards = () => true;
  workflows.updateWorkflowResults = args => {
    const write = lock.then(async () => {
      const { startGuard, completionGuard, ...rest } = args;
      const { workflowName, runId, stepId, result } = rest;
      const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
      assertWorkflowStepGuard({ snapshot, stepId, startGuard, completionGuard });
      const stored = snapshot?.context[stepId];
      const written = completionGuard?.pruneOnly
        ? { ...result, metadata: { ...stored?.metadata, ...result.metadata, __continuationStarted: true } }
        : result;
      const context = await update({ ...rest, result: written });
      const previous = startGuard?.previousStep;
      const previousResult = previous && context[previous.stepId];
      if (
        previous &&
        previous.stepId !== stepId &&
        previousResult?.status === 'success' &&
        previousResult.metadata?.startedBy === previous.eventId
      ) {
        return update({
          workflowName,
          runId,
          stepId: previous.stepId,
          result: {
            ...previous.result,
            metadata: { ...previousResult.metadata, ...previous.result.metadata, __continuationStarted: true },
          },
          requestContext: rest.requestContext,
        });
      }
      return context;
    });
    lock = write.catch(() => {});
    return write;
  };
  return storage;
}
