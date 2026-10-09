import type { OnboardingDraft } from './onboardingFlow';

/** Personal access also supplies the Factory model when no shared model was chosen. */
export function usesPersonalFactoryModel(draft: OnboardingDraft): boolean {
  if (draft.preset) return draft.preset.kind === 'individual';
  return !draft.model;
}
