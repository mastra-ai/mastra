import { describe, expect, it } from 'vitest';

import type { GithubRepo } from '../github';
import type { OnboardingDraft } from '../onboardingFlow';
import { nextOnboardingStep, restoredOnboardingStep } from '../onboardingSteps';

const repository: GithubRepo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

describe('onboarding sections', () => {
  it('opens the first section still missing a choice', () => {
    expect(nextOnboardingStep({})).toBe('vcs');
    expect(nextOnboardingStep({ repository })).toBe('project-management');
    expect(nextOnboardingStep({ repository, workConfirmed: true })).toBe('model');
  });

  it('reopens Codebase whenever the draft has no repository', () => {
    expect(restoredOnboardingStep('model', {})).toBe('vcs');
  });

  it('falls back to the next incomplete section when no section was stored', () => {
    expect(restoredOnboardingStep(undefined, { repository })).toBe('project-management');
  });

  it('keeps a reopened section open across a reload', () => {
    const complete: OnboardingDraft = {
      repository,
      workConfirmed: true,
      modelScope: 'factory',
      model: { providerId: 'openai', method: 'api_key', modelId: 'openai/gpt-5.6-sol' },
    };
    expect(restoredOnboardingStep('vcs', complete)).toBe('vcs');
  });
});
