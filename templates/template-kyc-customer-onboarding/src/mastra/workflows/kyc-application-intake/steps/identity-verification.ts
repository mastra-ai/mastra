import { createStep } from '@mastra/core/workflows';

import type { KycApplicationWorkflowDependencies } from '../contracts.js';

export const createIdentityVerificationStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep(dependencies.identityVerification);
