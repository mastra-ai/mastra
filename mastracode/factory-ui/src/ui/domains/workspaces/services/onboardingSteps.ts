import type { OnboardingModelScope, OnboardingStep } from './onboardingFlow';

export const SETUP_LABELS: Record<OnboardingModelScope, string> = {
  factory: 'Company account',
  hybrid: 'Company work · personal sessions',
  user: 'Personal accounts',
};

export function onboardingSteps(scope?: OnboardingModelScope, local = false): OnboardingStep[] {
  return [
    'initial',
    'vcs',
    'project-management',
    ...(local ? [] : (['model-setup'] as const)),
    ...(scope === 'user' ? [] : (['model-provider'] as const)),
    ...(scope === 'user' || scope === 'hybrid' ? (['personal-provider'] as const) : []),
    'review',
  ];
}

export const STEP_META: Record<OnboardingStep, { label: string; title: string; description?: string }> = {
  initial: { label: 'Welcome', title: 'Set up your factory.' },
  vcs: { label: 'Codebase', title: 'Choose your codebase.' },
  'project-management': { label: 'Work', title: 'Connect your work.' },
  'model-setup': {
    label: 'Setup',
    title: 'Choose your setup.',
    description: 'Choose whose accounts power this Factory.',
  },
  'model-provider': { label: 'Model', title: 'Choose your model.' },
  'personal-provider': { label: 'Model', title: 'Choose your model.' },
  review: {
    label: 'Review',
    title: 'Ready to create.',
    description: 'Review your Factory settings. Connected accounts are already saved.',
  },
};

export function onboardingStepMeta(step: OnboardingStep, scope?: OnboardingModelScope, local = false) {
  if (step === 'model-provider')
    return {
      ...STEP_META[step],
      description: companyModelDescription(scope, local),
    };
  if (step === 'personal-provider')
    return {
      ...STEP_META[step],
      title: scope === 'hybrid' ? 'Set up your sessions.' : 'Choose your model.',
      description:
        scope === 'hybrid'
          ? 'Your account · your default model for sessions.'
          : 'Your account · your default model for Factory work and sessions.',
    };
  return STEP_META[step];
}

function companyModelDescription(scope: OnboardingModelScope | undefined, local: boolean) {
  if (local) return 'Connect a provider and choose the model for your Factory.';
  if (scope === 'hybrid') return 'Company account · model for Factory work.';
  return 'Company account · model for Factory work and sessions.';
}
