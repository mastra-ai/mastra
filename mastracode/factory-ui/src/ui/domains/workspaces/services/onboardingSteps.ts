import type { OnboardingStep as Step } from './onboardingFlow';
import type { ModelSetupPreset } from './modelSetupPreset';
import { includesPersonalSetup } from './modelSetupPreset';

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
  'model-preset': {
    label: 'Setup',
    title: 'Choose your setup.',
    description: 'Choose which accounts to connect.',
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

export function onboardingSteps(preset?: ModelSetupPreset): Step[] {
  const start: Step[] = ['initial', 'vcs', 'project-management'];
  if (!preset) return [...start, 'model-provider', 'personal-provider', 'review'];
  if (preset.kind === 'individual') return [...start, 'model-preset', 'personal-provider', 'review'];
  if (includesPersonalSetup(preset)) return [...start, 'model-preset', 'model-provider', 'personal-provider', 'review'];
  return [...start, 'model-preset', 'model-provider', 'review'];
}

export function onboardingStepMeta(step: Step, preset?: ModelSetupPreset, personalIsFactoryModel = false) {
  if (step === 'personal-provider' && (preset?.kind === 'individual' || personalIsFactoryModel))
    return { title: 'Choose your model.', description: 'Your default model, also used for this Factory.' };
  if (!preset) return STEP_META[step];
  if (step === 'model-provider')
    return { title: 'Choose the Factory model.', description: 'Shared credentials · default for Factory work.' };
  if (step !== 'personal-provider') return STEP_META[step];
  return { title: 'Your personal model.', description: 'Optional · for your personal sessions.' };
}

export function personalModelChoice(
  preset?: ModelSetupPreset,
  personalIsFactoryModel = false,
): 'required' | 'optional' | undefined {
  if (!preset) return personalIsFactoryModel ? 'required' : undefined;
  return preset.kind === 'individual' ? 'required' : 'optional';
}

export function onboardingProgress(preset?: ModelSetupPreset): { label: string; steps: Step[] }[] {
  if (!preset)
    return onboardingSteps()
      .filter(step => step !== 'initial')
      .map(step => ({ label: STEP_META[step].label, steps: [step] }));
  return [
    { label: 'Codebase', steps: ['vcs'] },
    { label: 'Work', steps: ['project-management'] },
    { label: 'Setup', steps: ['model-preset'] },
    { label: 'Model', steps: ['model-provider', 'personal-provider'] },
    { label: 'Review', steps: ['review'] },
  ];
}
