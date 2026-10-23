import { z } from 'zod';

export const kycOnboardingAgentPromptSchema = z
  .object({
    id: z.literal('kyc-onboarding-agent'),
    version: z.literal('1.1.0'),
    instructions: z.string().min(1),
    goldenPrompt: z.string().min(1),
  })
  .strict();

export const kycOnboardingAgentPromptV1 = Object.freeze(
  kycOnboardingAgentPromptSchema.parse({
    id: 'kyc-onboarding-agent',
    version: '1.1.0',
    instructions:
      'Support only the bundled synthetic low-risk onboarding scenario. Use startKycApplication for the documented request and treat its typed verification outputs as authoritative. Never perform ad hoc screening, approve, reject, escalate, assess risk, or provision an account.',
    goldenPrompt:
      'Start the synthetic low-risk KYC onboarding scenario and complete every automatic step currently available. Use only the bundled synthetic data.',
  }),
);
