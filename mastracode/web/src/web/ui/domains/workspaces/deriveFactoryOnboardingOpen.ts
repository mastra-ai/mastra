import type { GithubStatus } from './services/github';

export type FactoryOnboardingOpenInput = {
  empty: boolean;
  /** False while backend factory list is still hydrating — do not treat empty cache as first-run. */
  factoriesSettled: boolean;
  explicitFactories: boolean;
  explicitGithub: boolean;
  status: GithubStatus | undefined;
  statusSettled: boolean;
  githubAvailable: boolean;
};

export type FactoryOnboardingOpen = {
  local: boolean;
  github: boolean;
};

/**
 * Pure first-run / overlay mount matrix for factory onboarding.
 * Explicit user intent wins; while empty and unsettled (factories or GitHub status),
 * mount neither (no local flash, no first-run before hydration).
 */
export function deriveFactoryOnboardingOpen(input: FactoryOnboardingOpenInput): FactoryOnboardingOpen {
  const { empty, factoriesSettled, explicitFactories, explicitGithub, status, statusSettled, githubAvailable } = input;

  if (explicitGithub) return { local: false, github: true };
  if (explicitFactories) return { local: true, github: false };
  if (!empty) return { local: false, github: false };
  // Wait for backend factory hydration before treating an empty cache as first-run.
  if (!factoriesSettled) return { local: false, github: false };
  if (!statusSettled) return { local: false, github: false };
  if (githubAvailable && status) return { local: false, github: true };
  return { local: true, github: false };
}

/** Same availability predicate as FactorySwitcher. */
export function isGithubAvailable(status: GithubStatus | undefined): boolean {
  return !!status && (status.enabled || !!status.authRequired);
}
