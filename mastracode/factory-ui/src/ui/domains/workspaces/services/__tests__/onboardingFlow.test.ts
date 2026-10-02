import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasResumableFactoryOnboarding,
  ONBOARDING_FACTORY_KEY,
  ONBOARDING_STEP_KEY,
  ONBOARDING_UPDATED_AT_KEY,
  persistOnboardingFactory,
  persistOnboardingStep,
  readOnboardingStep,
} from '../onboardingFlow';

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
  it('round-trips the personal provider step', () => {
    persistOnboardingStep('personal-provider');

    expect(readOnboardingStep()).toBe('personal-provider');
    expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBe('personal-provider');
    expect(sessionStorage.getItem(ONBOARDING_UPDATED_AT_KEY)).not.toBeNull();
  });

  it('resumes the personal provider step for its pending Factory', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    persistOnboardingStep('personal-provider');
    persistOnboardingFactory('factory-1');

    expect(sessionStorage.getItem(ONBOARDING_FACTORY_KEY)).toBe('factory-1');
    expect(hasResumableFactoryOnboarding([{ id: 'factory-1' }])).toBe(true);
    expect(hasResumableFactoryOnboarding([{ id: 'factory-2' }])).toBe(false);
  });
});
