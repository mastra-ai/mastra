import { describe, expect, it } from 'vitest';

import type { GithubStatus } from '../../services/github';
import { deriveFactoryOnboardingOpen, isGithubAvailable } from '../../deriveFactoryOnboardingOpen';

const enabledStatus: GithubStatus = {
  enabled: true,
  connected: false,
  installations: [],
};

const disabledStatus: GithubStatus = {
  enabled: false,
  connected: false,
  installations: [],
};

const authRequiredStatus: GithubStatus = {
  enabled: false,
  connected: false,
  installations: [],
  authRequired: true,
};

const base = {
  empty: true,
  factoriesSettled: true,
  explicitFactories: false,
  explicitGithub: false,
  status: enabledStatus as GithubStatus | undefined,
  statusSettled: true,
  githubAvailable: true,
};

describe('isGithubAvailable', () => {
  it('is true when enabled or authRequired', () => {
    expect(isGithubAvailable(enabledStatus)).toBe(true);
    expect(isGithubAvailable(authRequiredStatus)).toBe(true);
    expect(isGithubAvailable(disabledStatus)).toBe(false);
    expect(isGithubAvailable(undefined)).toBe(false);
  });
});

describe('deriveFactoryOnboardingOpen', () => {
  it('explicit github wins', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        explicitFactories: true,
        explicitGithub: true,
      }),
    ).toEqual({ local: false, github: true });
  });

  it('explicit factories wins over forced github', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        explicitFactories: true,
        explicitGithub: false,
      }),
    ).toEqual({ local: true, github: false });
  });

  it('does not force a modal when factories already exist', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        empty: false,
        explicitFactories: false,
        explicitGithub: false,
      }),
    ).toEqual({ local: false, github: false });
  });

  it('pending factory hydration mounts neither on first-run', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        factoriesSettled: false,
        status: undefined,
        statusSettled: true,
        githubAvailable: false,
      }),
    ).toEqual({ local: false, github: false });
  });

  it('pending github status mounts neither on first-run', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        status: undefined,
        statusSettled: false,
        githubAvailable: false,
      }),
    ).toEqual({ local: false, github: false });
  });

  it('first-run + github available opens github', () => {
    expect(deriveFactoryOnboardingOpen(base)).toEqual({ local: false, github: true });
  });

  it('first-run + authRequired opens github', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        status: authRequiredStatus,
        githubAvailable: true,
      }),
    ).toEqual({ local: false, github: true });
  });

  it('first-run + github disabled opens local', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        status: disabledStatus,
        githubAvailable: false,
      }),
    ).toEqual({ local: true, github: false });
  });

  it('github available without status data does not open github', () => {
    expect(
      deriveFactoryOnboardingOpen({
        ...base,
        status: undefined,
        githubAvailable: true,
      }),
    ).toEqual({ local: true, github: false });
  });
});
