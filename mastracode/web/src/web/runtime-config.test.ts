import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetRuntimeConfigForTests, getAppDatabaseUrl, getPublicUrl, seedRuntimeConfig } from './runtime-config';

const ORIGINAL_APP_DATABASE_URL = process.env.APP_DATABASE_URL;

describe('runtime-config', () => {
  beforeEach(() => {
    __resetRuntimeConfigForTests();
    delete process.env.APP_DATABASE_URL;
  });

  afterEach(() => {
    __resetRuntimeConfigForTests();
    if (ORIGINAL_APP_DATABASE_URL === undefined) {
      delete process.env.APP_DATABASE_URL;
    } else {
      process.env.APP_DATABASE_URL = ORIGINAL_APP_DATABASE_URL;
    }
  });

  describe('getAppDatabaseUrl', () => {
    it('returns the seeded database URL', () => {
      seedRuntimeConfig({ databaseUrl: 'postgres://seeded/app' });
      expect(getAppDatabaseUrl()).toBe('postgres://seeded/app');
    });

    it('prefers the seeded config over the env fallback', () => {
      process.env.APP_DATABASE_URL = 'postgres://env/app';
      seedRuntimeConfig({ databaseUrl: 'postgres://seeded/app' });
      expect(getAppDatabaseUrl()).toBe('postgres://seeded/app');
    });

    it('seeding without a database wins over env (factory config is authoritative)', () => {
      process.env.APP_DATABASE_URL = 'postgres://env/app';
      seedRuntimeConfig({});
      expect(getAppDatabaseUrl()).toBeUndefined();
    });

    it('falls back to APP_DATABASE_URL when the factory has not seeded (back-compat)', () => {
      process.env.APP_DATABASE_URL = 'postgres://env/app';
      expect(getAppDatabaseUrl()).toBe('postgres://env/app');
    });

    it('treats an empty env var as unconfigured', () => {
      process.env.APP_DATABASE_URL = '';
      expect(getAppDatabaseUrl()).toBeUndefined();
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

  it('__resetRuntimeConfigForTests clears the seeded config', () => {
    seedRuntimeConfig({ databaseUrl: 'postgres://seeded/app', publicUrl: 'https://factory.acme.com' });
    __resetRuntimeConfigForTests();
    expect(getPublicUrl()).toBeUndefined();
    expect(getAppDatabaseUrl()).toBeUndefined();
  });
});
