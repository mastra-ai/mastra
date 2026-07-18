import { PostgresStore } from '@mastra/pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { WebAuthAdapter } from './auth-adapter';
import {
  __resetRuntimeConfigForTests,
  getPublicUrl,
  getSeededAuthAdapter,
  getSeededStorage,
  getSharedAppPool,
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
    it('returns the seeded storage instance', () => {
      const storage = new PostgresStore({ id: 'test-storage', connectionString: 'postgres://seeded/app' });
      seedRuntimeConfig({ storage });
      expect(getSeededStorage()).toBe(storage);
    });

    it('is undefined when the factory seeded without storage', () => {
      seedRuntimeConfig({});
      expect(getSeededStorage()).toBeUndefined();
    });
  });

  describe('getSharedAppPool', () => {
    it('exposes the PostgresStore pool for app-table consumers', () => {
      const storage = new PostgresStore({ id: 'test-storage', connectionString: 'postgres://seeded/app' });
      seedRuntimeConfig({ storage });
      expect(getSharedAppPool()).toBe(storage.pool);
    });

    it('returns undefined for a non-Postgres storage instance', () => {
      const storage = { init: async () => {} } as unknown as MastraCompositeStore;
      seedRuntimeConfig({ storage });
      expect(getSharedAppPool()).toBeUndefined();
    });

    it('returns undefined before seeding (no env fallback — factory config is authoritative)', () => {
      expect(getSharedAppPool()).toBeUndefined();
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
    const storage = new PostgresStore({ id: 'test-storage', connectionString: 'postgres://seeded/app' });
    seedRuntimeConfig({ storage, publicUrl: 'https://factory.acme.com' });
    __resetRuntimeConfigForTests();
    expect(getPublicUrl()).toBeUndefined();
    expect(getSeededStorage()).toBeUndefined();
    expect(getSharedAppPool()).toBeUndefined();
  });
});
