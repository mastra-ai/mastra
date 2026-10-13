import type { OnboardingStep } from './onboardingFlow';

export const STEP_META: Record<OnboardingStep, { label: string; title: string; description?: string }> = {
  initial: { label: 'Welcome', title: 'Set up your factory.' },
  vcs: { label: 'Codebase', title: 'Choose your codebase.' },
  'project-management': { label: 'Work', title: 'Connect your work.' },
  'model-provider': {
    label: 'Model',
    title: 'Choose your model.',
    description: 'Organization access · shared Factory model.',
  },
  'personal-provider': {
    label: 'Access',
    title: 'Make it yours.',
    description: 'Your connections · optional, only for you.',
  },
  review: {
    label: 'Review',
    title: 'Ready to create.',
    description: 'Review your choices. Everything stays editable until you create your factory.',
  },
};

export function onboardingStepMeta(step: OnboardingStep, personalIsFactoryModel: boolean) {
  if (step === 'personal-provider' && personalIsFactoryModel)
    return { title: 'Choose your model.', description: 'Your default model, also used for this Factory.' };
  return STEP_META[step];
}
