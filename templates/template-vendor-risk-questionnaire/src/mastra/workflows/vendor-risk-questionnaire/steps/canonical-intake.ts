import { createStep } from '@mastra/core/workflows';
import { draftInputSchema } from '../../vendor-risk-drafts/contracts.ts';
import type { DraftWorkflowOptions } from '../../vendor-risk-drafts/runtime.ts';
import { openIntakeStore } from '../../../persistence/store.ts';
import { databaseUrl } from '../../../persistence/database.ts';

// Intake already parsed and persisted the source. This step only checks that it is ready for drafting.
export function createCanonicalIntakeStep(options: DraftWorkflowOptions) {
  return createStep({
    id: 'canonical-intake',
    inputSchema: draftInputSchema,
    outputSchema: draftInputSchema,
    execute: async ({ inputData }) => {
      const store = await openIntakeStore(options.databaseUrl ?? databaseUrl);
      try {
        const intake = await store.readIntake(inputData.runId),
          evidence = await store.readEvidence(inputData.runId);
        if (!intake || !evidence || intake.input.organizationId !== evidence.scope.organizationId)
          throw new Error('CANONICAL_INTAKE_REQUIRED');
        return inputData;
      } finally {
        store.close();
      }
    },
  });
}
