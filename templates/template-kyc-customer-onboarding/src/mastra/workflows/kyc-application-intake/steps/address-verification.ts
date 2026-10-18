import { createStep } from '@mastra/core/workflows';

import type { KycApplicationWorkflowDependencies } from '../contracts.js';

export const createAddressVerificationStep = (dependencies: KycApplicationWorkflowDependencies) =>
  createStep(dependencies.addressVerification);
