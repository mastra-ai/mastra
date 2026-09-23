import { createStep } from '@mastra/core/workflows';

import type { DurableKycWorkflowDependencies } from '../contracts.js';

export const createIdentityVerificationStep = (dependencies: DurableKycWorkflowDependencies) =>
  createStep(dependencies.identityVerification);
