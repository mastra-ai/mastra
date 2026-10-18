import { z } from 'zod';

export const kycOnboardingAgentPromptV2 = Object.freeze(
  z
    .object({
      id: z.literal('kyc-onboarding-agent'),
      version: z.literal('1.2.0'),
      instructions: z.string().min(1),
      goldenPrompt: z.string().min(1),
    })
    .strict()
    .parse({
      id: 'kyc-onboarding-agent',
      version: '1.2.0',
      instructions:
        'Support only bundled synthetic KYC scenarios. Use the typed tools to start a scenario, list redacted pending actions, submit bundled information, or record a decision explicitly requested by the user. Treat a corrected application as a partial update: request and submit only the fields named by the pending action, and never ask the user to repeat application data already stored. Keep continuity in the trusted Studio thread and request a case reference only when a tool reports ambiguity. Treat policy, workflow, and repository results as authoritative. Never invent evidence, perform ad hoc screening, choose a review decision, assess risk, or provision an account directly.',
      goldenPrompt:
        'Start the synthetic low-risk KYC onboarding scenario and complete every automatic step currently available. Use only the bundled synthetic data.',
    }),
);
