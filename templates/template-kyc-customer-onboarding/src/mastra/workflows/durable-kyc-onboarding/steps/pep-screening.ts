import { createStep } from '@mastra/core/workflows';

import type { DurableKycWorkflowDependencies } from '../contracts.js';

export const createPepScreeningStep = (dependencies: DurableKycWorkflowDependencies) =>
  createStep(dependencies.pepScreening);
