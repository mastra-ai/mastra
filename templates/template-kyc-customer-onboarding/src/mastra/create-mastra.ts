import { Mastra } from '@mastra/core/mastra';
import type { LibSQLStore } from '@mastra/libsql';

import type { KycOnboardingAgent } from './agents/kyc-onboarding-agent.js';
import type { KycApplicationWorkflow } from './workflows/kyc-application-intake.js';
import type { DurableKycOnboardingWorkflow } from './workflows/durable-kyc-onboarding.js';
import { kycScorers } from '../evals/kyc-scorers.js';
import { createKycObservability } from '../observability/create-observability.js';

export const createMastra = (
  storage: LibSQLStore,
  kycApplicationWorkflow: KycApplicationWorkflow,
  durableKycOnboardingWorkflow: DurableKycOnboardingWorkflow,
  kycOnboardingAgent: KycOnboardingAgent,
): Mastra =>
  new Mastra({
    storage,
    observability: createKycObservability(),
    scorers: kycScorers,
    agents: { kycOnboardingAgent },
    workflows: { kycApplicationWorkflow, durableKycOnboardingWorkflow },
  });
