import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { RequestContext } from '@mastra/core/request-context';
import { intakeResultSchema, runReferenceSchema } from '../contracts';
import type { IntakeConfig } from '../config/intake';
import type { IntakeStore } from '../persistence/intake';

export function createIntakeWorkflow(store: IntakeStore, config: IntakeConfig) {
  // Object identity cannot be supplied through native API request-context JSON.
  const dispatchBinding = Object.freeze({ sourceId: config.source.id });
  const receive = createStep({
    id: 'record-intake',
    inputSchema: runReferenceSchema,
    outputSchema: intakeResultSchema,
    execute: async ({ inputData, runId, requestContext }) => {
      const accepted = await store.get(inputData.runId);
      if (
        requestContext?.get('intakeDispatch') !== dispatchBinding ||
        runId !== inputData.runId ||
        !accepted ||
        accepted.status !== 'dispatching' ||
        accepted.event.sourceId !== config.source.id ||
        accepted.event.destination.providerId !== config.source.destinationProviderId
      ) {
        throw new Error('Workflow requires an accepted operational association and trusted dispatch');
      }
      return { runId: accepted.runId, status: 'intake_received' as const };
    },
  });
  const workflow = createWorkflow({
    id: 'lead-intake',
    inputSchema: runReferenceSchema,
    outputSchema: intakeResultSchema,
    options: { autoRestartActiveRuns: false },
  })
    .then(receive)
    .commit();
  function bind(context: RequestContext) {
    context.set('intakeDispatch', dispatchBinding);
    context.set('sourceId', config.source.id);
    context.set('destinationProviderId', config.source.destinationProviderId);
    return context;
  }
  return { workflow, bind };
}
export type IntakeWorkflow = ReturnType<typeof createIntakeWorkflow>;
