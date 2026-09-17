import { createStep } from '@mastra/core/workflows';

import type { KycApplicationWorkflowDependencies } from '../contracts.js';

export const createSanctionsScreeningStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep(dependencies.sanctionsScreening);
