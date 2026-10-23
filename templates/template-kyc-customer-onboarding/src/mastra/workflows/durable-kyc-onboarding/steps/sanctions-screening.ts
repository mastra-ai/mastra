import { createStep } from '@mastra/core/workflows';

import type { DurableKycWorkflowDependencies } from '../contracts.js';

export const createSanctionsScreeningStep = (dependencies: DurableKycWorkflowDependencies) =>
  createStep(dependencies.sanctionsScreening);
