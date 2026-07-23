/**
 * Session-scoped markers for the `/onboarding` wizard (`EmptyFactoryState`).
 * The step and pending factory id survive full-page OAuth redirects
 * (GitHub/Linear) so the flow can resume where it left off. The
 * `/factories/create` wizard uses separate keys (`useCreateFactoryFlow`) so
 * the two flows never collide.
 */
export const ONBOARDING_STEP_KEY = 'mastracode.factory-onboarding.step';
export const ONBOARDING_FACTORY_KEY = 'mastracode.factory-onboarding.factory-id';

/**
 * Whether an onboarding flow is mid-way with its factory already created —
 * the only case where `/onboarding` may stay open (and `/` must route back
 * into it) even though a factory exists. Picking a repository creates the
 * factory mid-flow, and the GitHub/Linear OAuth callbacks land on `/`, so
 * without this check the wizard would be abandoned at the factory home.
 * The stored factory id is validated against the server-backed list so stale
 * markers for a deleted factory never trap the user in onboarding.
 */
export function hasResumableFactoryOnboarding(factories: readonly { id: string }[]): boolean {
  const step = sessionStorage.getItem(ONBOARDING_STEP_KEY);
  if (step !== 'vcs' && step !== 'project-management') return false;

  const pendingFactoryId = sessionStorage.getItem(ONBOARDING_FACTORY_KEY);
  return pendingFactoryId !== null && factories.some(factory => factory.id === pendingFactoryId);
}
