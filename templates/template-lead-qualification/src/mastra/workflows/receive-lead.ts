import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { RequestContext } from '@mastra/core/request-context';
import { intakeResultSchema, runReferenceSchema } from '../contracts';
import type { IntakeConfig } from '../config/lead-ingestion';
import type { LeadEventStore } from '../persistence/lead-event-store';
import type { QualificationService } from '../research/qualification';
import { assessmentSchema } from '../research/contracts';

export function createReceiveLeadWorkflow(
  store: LeadEventStore,
  config: IntakeConfig,
  qualification: QualificationService,
) {
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
  const qualifiedResultSchema = intakeResultSchema.extend({ assessment: assessmentSchema.nullable() });
  const qualify = createStep({
    id: 'qualify-company',
    inputSchema: intakeResultSchema,
    outputSchema: qualifiedResultSchema,
    execute: async ({ inputData, runId, requestContext }) => {
      const accepted = await store.get(inputData.runId);
      if (
        requestContext?.get('intakeDispatch') !== dispatchBinding ||
        runId !== inputData.runId ||
        accepted?.status !== 'dispatching'
      )
        throw new Error('Qualification requires trusted dispatch of the accepted run');
      const assessment = await qualification.qualify(accepted.runId, accepted.event);
      if (assessment?.processingStatus === 'failed')
        throw new Error('Research failed without usable source material; inspect the persisted assessment');
      return { ...inputData, assessment };
    },
  });
  const workflow = createWorkflow({
    id: 'lead-intake',
    inputSchema: runReferenceSchema,
    outputSchema: qualifiedResultSchema,
    options: { autoRestartActiveRuns: false },
  })
    .then(receive)
    .then(qualify)
    .commit();
  function authorizeDispatchContext(context: RequestContext) {
    context.set('intakeDispatch', dispatchBinding);
    context.set('sourceId', config.source.id);
    context.set('destinationProviderId', config.source.destinationProviderId);
    return context;
  }
  return { workflow, authorizeDispatchContext };
}
export type ReceiveLeadWorkflow = ReturnType<typeof createReceiveLeadWorkflow>;
