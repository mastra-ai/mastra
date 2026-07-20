import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebAuthAdapter } from './auth-adapter';
import {
  __resetRuntimeConfigForTests,
  getFactoryStorage,
  getPublicUrl,
  getSeededAuthAdapter,
  getSeededStorage,
  isRuntimeConfigSeeded,
  seedRuntimeConfig,
} from './runtime-config';

describe('runtime-config', () => {
  beforeEach(() => {
    __resetRuntimeConfigForTests();
  });

  afterEach(() => {
    __resetRuntimeConfigForTests();
  });

  describe('storage slot', () => {
    it('returns the seeded storage backend', () => {
      const storage = new LibSQLFactoryStorage({ id: 'test-storage', url: ':memory:' });
      seedRuntimeConfig({ storage });
      expect(getSeededStorage()).toBe(storage);
    });

    it('is undefined when the factory seeded without storage', () => {
      seedRuntimeConfig({});
      expect(getSeededStorage()).toBeUndefined();
    });
  });

  describe('getFactoryStorage', () => {
    it('exposes the factory storage backend for app-table consumers', () => {
      const storage = new LibSQLFactoryStorage({ id: 'test-storage', url: ':memory:' });
      seedRuntimeConfig({ storage });
      expect(getFactoryStorage()).toBe(storage);
    });

    it('throws before seeding (no env fallback — factory config is authoritative)', () => {
      expect(() => getFactoryStorage()).toThrow(/MastraFactory\.prepare\(\) has not run/);
    });
  });

  describe('getPublicUrl', () => {
    it('returns undefined before seeding', () => {
      expect(getPublicUrl()).toBeUndefined();
    });

    it('returns the seeded public URL', () => {
      seedRuntimeConfig({ publicUrl: 'https://factory.acme.com' });
      expect(getPublicUrl()).toBe('https://factory.acme.com');
    });
  });

  describe('auth adapter slot', () => {
    const adapter = { kind: 'fake' } as WebAuthAdapter;

    it('is unseeded before the factory runs', () => {
      expect(isRuntimeConfigSeeded()).toBe(false);
      expect(getSeededAuthAdapter()).toBeUndefined();
    });

    it('returns the seeded adapter', () => {
      seedRuntimeConfig({ authAdapter: adapter });
      expect(isRuntimeConfigSeeded()).toBe(true);
      expect(getSeededAuthAdapter()).toBe(adapter);
    });

    it('seeding without an adapter marks auth explicitly disabled', () => {
      seedRuntimeConfig({});
      expect(isRuntimeConfigSeeded()).toBe(true);
      expect(getSeededAuthAdapter()).toBeUndefined();
    });
  });

  it('__resetRuntimeConfigForTests clears the seeded config', () => {
    const storage = new LibSQLFactoryStorage({ id: 'test-storage', url: ':memory:' });
    seedRuntimeConfig({ storage, publicUrl: 'https://factory.acme.com' });
    __resetRuntimeConfigForTests();
    expect(getPublicUrl()).toBeUndefined();
    expect(getSeededStorage()).toBeUndefined();
    expect(() => getFactoryStorage()).toThrow(/MastraFactory\.prepare\(\) has not run/);
  });
});
