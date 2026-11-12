import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasResumableFactoryOnboarding,
  onboardingCreateReadiness,
  ONBOARDING_FACTORY_KEY,
  ONBOARDING_LINKED_REPOSITORY_KEY,
  ONBOARDING_STEP_KEY,
  ONBOARDING_UPDATED_AT_KEY,
  persistOnboardingDraft,
  persistOnboardingFactory,
  persistOnboardingStep,
  readOnboardingDraft,
  readOnboardingStep,
  readOnboardingLinkedRepositories,
} from '../onboardingFlow';
import type { OnboardingDraft } from '../onboardingFlow';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  vi.restoreAllMocks();
});

describe('Factory onboarding flow', () => {
  it('ignores a corrupt repository link marker', () => {
    sessionStorage.setItem(ONBOARDING_LINKED_REPOSITORY_KEY, 'link-original');
    expect(readOnboardingLinkedRepositories()).toEqual([]);
  });

  it('keeps the flow going when session storage refuses writes', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => persistOnboardingStep('vcs')).not.toThrow();
    expect(readOnboardingStep()).toBeUndefined();
  });

  it('round-trips the open Model section', () => {
    persistOnboardingStep('model');

    expect(readOnboardingStep()).toBe('model');
    expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBe('model');
    expect(sessionStorage.getItem(ONBOARDING_UPDATED_AT_KEY)).not.toBeNull();
  });

  it('resumes an old wizard step for its pending Factory but opens no stored section', () => {
    persistOnboardingStep('model');
    persistOnboardingFactory('factory-1');
    sessionStorage.setItem(ONBOARDING_STEP_KEY, 'review');

    expect(readOnboardingStep()).toBeUndefined();
    expect(hasResumableFactoryOnboarding([{ id: 'factory-1' }])).toBe(true);
  });

  it('counts a connected provider without a model as missing for Create', () => {
    const readiness = onboardingCreateReadiness({
      repository: {
        id: 1,
        fullName: 'octo/hello',
        name: 'hello',
        owner: 'octo',
        defaultBranch: 'main',
        private: false,
        installationId: 7,
        installationStorageId: 'inst-7',
        sandboxProvider: 'local',
        sandboxWorkdir: '/workspace/hello',
      },
      modelScope: 'hybrid',
      model: { providerId: 'openai', method: 'api_key', modelId: '' },
      personal: { providerId: 'anthropic', method: 'oauth', modelId: 'anthropic/claude-opus-5.5' },
    });

    expect(readiness).toEqual({ ready: false, missing: ['model'] });
  });

  it('keeps a connected personal provider without a model across reads', () => {
    const draft: OnboardingDraft = {
      modelScope: 'hybrid',
      personal: { providerId: 'anthropic', method: 'oauth', modelId: '' },
    };
    persistOnboardingDraft(draft);
    expect(readOnboardingDraft()).toEqual(draft);
  });

  it('resumes the open Model section for its pending Factory', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    persistOnboardingStep('model');
    persistOnboardingFactory('factory-1');

    expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('factory-1');
    expect(hasResumableFactoryOnboarding([{ id: 'factory-1' }])).toBe(true);
    expect(hasResumableFactoryOnboarding([{ id: 'factory-2' }])).toBe(false);
  });
});
