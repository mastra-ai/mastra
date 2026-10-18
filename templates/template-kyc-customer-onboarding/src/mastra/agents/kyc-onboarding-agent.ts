import { Agent } from '@mastra/core/agent';

import { loadKycOnboardingAgentPrompt } from '../../config/prompts/load-kyc-onboarding-agent-prompt.js';
import { fixtureKycOnboardingModel } from '../../providers/local/fixture-agent-model.js';
import type { StartKycApplicationTool } from '../tools/start-kyc-application.js';
import type {
  DecideKycReviewTool,
  ListPendingKycActionsTool,
  SubmitKycInformationTool,
} from '../tools/resume-kyc-application.js';

export type KycOnboardingAgentTools = Readonly<{
  startKycApplication: StartKycApplicationTool;
  listPendingKycActions: ListPendingKycActionsTool;
  submitKycInformation: SubmitKycInformationTool;
  decideKycReview: DecideKycReviewTool;
}>;

export const createKycOnboardingAgent = (tools: KycOnboardingAgentTools, modelId = 'fixture') => {
  const prompt = loadKycOnboardingAgentPrompt();
  return new Agent({
    id: 'kyc-onboarding-agent',
    name: 'KYC Onboarding Agent',
    instructions: prompt.instructions,
    model: modelId === 'fixture' ? fixtureKycOnboardingModel : modelId,
    tools,
    maxRetries: 0,
  });
};

export type KycOnboardingAgent = ReturnType<typeof createKycOnboardingAgent>;
