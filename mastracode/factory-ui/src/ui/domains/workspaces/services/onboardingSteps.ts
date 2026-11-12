import type { OnboardingDraft, OnboardingModelScope, OnboardingStep } from './onboardingFlow';

export const SETUP_LABELS: Record<OnboardingModelScope, string> = {
  factory: 'Company account',
  hybrid: 'Company work and personal sessions',
  user: 'Personal accounts',
};

export const SETUP_DETAILS: Record<OnboardingModelScope, string> = {
  factory: 'A shared account and model for Factory work and sessions.',
  hybrid: 'Factory work uses the company account. Each person uses their own account for sessions.',
  user: 'Each person uses their own account and default model, for Factory work and sessions.',
};

/**
 * The page's numbered cards. Accounts (who pays) and Model (the providers behind those accounts) open
 * together as the Model step, so a change of accounts shows its providers right away.
 */
export type OnboardingSection = OnboardingStep | 'accounts';

export const ONBOARDING_SECTIONS: Record<OnboardingSection, { index: number; label: string }> = {
  vcs: { index: 1, label: 'Codebase' },
  'project-management': { index: 2, label: 'Work' },
  accounts: { index: 3, label: 'Accounts' },
  model: { index: 4, label: 'Model' },
};

/** First section still missing a choice; Model once Codebase and Work are settled. */
export function nextOnboardingStep(draft: OnboardingDraft): OnboardingStep {
  if (!draft.repository) return 'vcs';
  if (!draft.workConfirmed) return 'project-management';
  return 'model';
}

/** A draft without a repository always reopens Codebase; otherwise the stored open section wins. */
export function restoredOnboardingStep(saved: OnboardingStep | undefined, draft: OnboardingDraft): OnboardingStep {
  if (!draft.repository) return 'vcs';
  return saved ?? nextOnboardingStep(draft);
}
