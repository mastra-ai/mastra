import { kycOnboardingAgentPromptV1 } from './kyc-onboarding-agent-v1.js';
import { kycOnboardingAgentPromptV2 } from './kyc-onboarding-agent-v2.js';

export const loadKycOnboardingAgentPrompt = (version = '1.2.0') => {
  if (version === kycOnboardingAgentPromptV1.version) return kycOnboardingAgentPromptV1;
  if (version === kycOnboardingAgentPromptV2.version) return kycOnboardingAgentPromptV2;
  throw new Error(`Unknown KYC onboarding agent prompt version: ${version}`);
};
