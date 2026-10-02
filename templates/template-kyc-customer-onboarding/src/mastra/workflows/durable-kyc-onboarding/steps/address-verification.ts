import { createStep } from '@mastra/core/workflows';

import type { DurableKycWorkflowDependencies } from '../contracts.js';

export const createAddressVerificationStep = (dependencies: DurableKycWorkflowDependencies) =>
  createStep(dependencies.addressVerification);
