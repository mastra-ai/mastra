import type { OnboardingDraft } from './onboardingFlow';

/** Personal access also supplies the Factory model when no shared model was chosen. */
export function usesPersonalFactoryModel(draft: OnboardingDraft): boolean {
  return !draft.model;
}
