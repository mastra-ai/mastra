/**
 * Session-scoped markers for the `/onboarding` wizard (`EmptyFactoryState`).
 * The step and pending factory id survive full-page OAuth redirects
 * (GitHub/Linear) so the flow can resume where it left off. The
 * `/factories/create` wizard uses separate keys (`useCreateFactoryFlow`) so
 * the two flows never collide.
 *
 * Every write also stamps `updated-at`: resumability is time-bound so a stale
 * tab (or markers written by an older version of the flow) can never trap the
 * user in onboarding once a factory exists.
 */
export const ONBOARDING_STEP_KEY = 'mastracode.factory-onboarding.step';
export const ONBOARDING_FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';
export const ONBOARDING_UPDATED_AT_KEY = 'mastracode.factory-onboarding.updated-at';

/**
 * How long a mid-flow marker stays resumable after the flow last progressed.
 * Generous for an OAuth consent screen (seconds to minutes), far too short
 * for an abandoned tab rediscovered hours later.
 */
export const ONBOARDING_RESUME_WINDOW_MS = 30 * 60 * 1000;

export type OnboardingStep = 'initial' | 'vcs' | 'project-management';

/** Persist the current step and refresh the resume window. */
export function persistOnboardingStep(step: OnboardingStep): void {
  sessionStorage.setItem(ONBOARDING_STEP_KEY, step);
  sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
}

/** Persist the mid-flow factory id and refresh the resume window. */
export function persistOnboardingFactory(factoryId: string): void {
  sessionStorage.setItem(ONBOARDING_FACTORY_KEY, factoryId);
  sessionStorage.setItem(ONBOARDING_UPDATED_AT_KEY, String(Date.now()));
}

/** Read the persisted step, defaulting to the beginning of the flow. */
export function readOnboardingStep(): OnboardingStep {
  const value = sessionStorage.getItem(ONBOARDING_STEP_KEY);
  return value === 'vcs' || value === 'project-management' ? value : 'initial';
}

/** Drop every onboarding marker (flow finished or abandoned). */
export function clearOnboardingFlow(): void {
  sessionStorage.removeItem(ONBOARDING_STEP_KEY);
  sessionStorage.removeItem(ONBOARDING_FACTORY_KEY);
  sessionStorage.removeItem(ONBOARDING_UPDATED_AT_KEY);
}

/**
 * Whether an onboarding flow is mid-way with its factory already created —
 * the only case where `/onboarding` may stay open (and `/` must route back
 * into it) even though a factory exists. Picking a repository creates the
 * factory mid-flow, and the GitHub/Linear OAuth callbacks land on `/`, so
 * without this check the wizard would be abandoned at the factory home.
 *
 * Three gates, all required:
 * - a mid-flow step is stored (`vcs` / `project-management`),
 * - the stored factory id exists in the server-backed list (a deleted
 *   factory never traps the user),
 * - the flow progressed within {@link ONBOARDING_RESUME_WINDOW_MS} (markers
 *   without a fresh timestamp — including ones written by older versions of
 *   the flow — are treated as abandoned).
 */
export function hasResumableFactoryOnboarding(factories: readonly { id: string }[]): boolean {
  const step = sessionStorage.getItem(ONBOARDING_STEP_KEY);
  if (step !== 'vcs' && step !== 'project-management') return false;

  const updatedAt = Number(sessionStorage.getItem(ONBOARDING_UPDATED_AT_KEY));
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > ONBOARDING_RESUME_WINDOW_MS) return false;

  const pendingFactoryId = sessionStorage.getItem(ONBOARDING_FACTORY_KEY);
  return pendingFactoryId !== null && factories.some(factory => factory.id === pendingFactoryId);
}
