import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { screeningCheckOutputSchema, verificationCheckOutputSchema } from '../../../../services/check-execution.js';
import { progressSchema } from './prepare-progress.js';

const aggregateResumedChecksInputSchema = z
  .object({
    'identity-verification-v1': verificationCheckOutputSchema,
    'address-verification-v1': verificationCheckOutputSchema,
    'sanctions-screening-v1': screeningCheckOutputSchema,
    'pep-screening-v1': screeningCheckOutputSchema,
  })
  .strict();

export const createAggregateResumedChecksStep = () =>
  createStep({
    id: 'aggregate-resumed-checks-v1',
    inputSchema: aggregateResumedChecksInputSchema,
    outputSchema: progressSchema,
    execute: context => {
      const initial = progressSchema.parse(context.getInitData());
      const checks = {
        identity: context.inputData['identity-verification-v1'],
        address: context.inputData['address-verification-v1'],
        sanctions: context.inputData['sanctions-screening-v1'],
        pep: context.inputData['pep-screening-v1'],
      };
      return Promise.resolve(
        progressSchema.parse({
          ...initial,
          checks,
          evidenceIds: [
            ...initial.evidenceIds,
            checks.identity.evidence.id,
            checks.address.evidence.id,
            checks.sanctions.evidence.id,
            checks.pep.evidence.id,
          ],
          automaticSteps: [...initial.automaticSteps, 'resumed-parallel-verification'],
        }),
      );
    },
  });
