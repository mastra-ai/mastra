import type { OnboardingStep as Step } from './onboardingFlow';

export const STEP_META: Record<Step, { label: string; title: string; description: string }> = {
  initial: {
    label: 'Welcome',
    title: 'Set up your factory.',
    description: '',
  },
  vcs: {
    label: 'Codebase',
    title: 'Choose your codebase.',
    description: '',
  },
  'project-management': {
    label: 'Work',
    title: 'Connect your work.',
    description: '',
  },
  'model-provider': {
    label: 'Model',
    title: 'Choose your model.',
    description: 'Organization access · shared Factory model.',
  },
  review: {
    label: 'Review',
    title: 'Ready to create.',
    description: 'Review your choices. Everything stays editable until you create your factory.',
  },
  'personal-provider': {
    label: 'Access',
    title: 'Make it yours.',
    description: 'Your connections · optional, only for you.',
  },
};

export function onboardingSteps(): Step[] {
  return ['initial', 'vcs', 'project-management', 'model-provider', 'personal-provider', 'review'];
}

export function onboardingStepMeta(step: Step, personalIsFactoryModel = false) {
  if (step === 'personal-provider' && personalIsFactoryModel)
    return { title: 'Choose your model.', description: 'Your default model, also used for this Factory.' };
  return STEP_META[step];
}

export function onboardingProgress(): { label: string; steps: Step[] }[] {
  return onboardingSteps()
    .filter(step => step !== 'initial')
    .map(step => ({ label: STEP_META[step].label, steps: [step] }));
}
