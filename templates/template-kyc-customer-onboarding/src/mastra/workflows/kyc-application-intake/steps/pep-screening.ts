import { createStep } from '@mastra/core/workflows';

import type { KycApplicationWorkflowDependencies } from '../contracts.js';

export const createPepScreeningStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep(dependencies.pepScreening);
