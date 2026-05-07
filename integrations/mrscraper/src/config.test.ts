import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeBearerToken, resolveAppToken, resolveSyncAccessToken } from './config.js';

describe('MrScraper config', () => {
  const env: Record<string, string | undefined> = {};

  beforeEach(() => {
    env.MRSCRAPER_API_TOKEN = process.env.MRSCRAPER_API_TOKEN;
    env.MRSCRAPER_TOKEN = process.env.MRSCRAPER_TOKEN;
    env.MRSCRAPER_SYNC_ACCESS_TOKEN = process.env.MRSCRAPER_SYNC_ACCESS_TOKEN;
    env.MRSCRAPER_SERP_ACCESS_TOKEN = process.env.MRSCRAPER_SERP_ACCESS_TOKEN;
    delete process.env.MRSCRAPER_API_TOKEN;
    delete process.env.MRSCRAPER_TOKEN;
    delete process.env.MRSCRAPER_SYNC_ACCESS_TOKEN;
    delete process.env.MRSCRAPER_SERP_ACCESS_TOKEN;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('resolveAppToken throws when unset', () => {
    expect(() => resolveAppToken()).toThrow('MrScraper app token is required');
  });

  it('resolveAppToken uses explicit config', () => {
    expect(resolveAppToken({ token: '  tk  ' })).toBe('tk');
  });

  it('resolveAppToken falls back to MRSCRAPER_API_TOKEN', () => {
    process.env.MRSCRAPER_API_TOKEN = 'from-env';
    expect(resolveAppToken()).toBe('from-env');
  });

  it('resolveAppToken falls back to MRSCRAPER_TOKEN', () => {
    process.env.MRSCRAPER_TOKEN = 'from-token-env';
    expect(resolveAppToken()).toBe('from-token-env');
  });

  it('resolveSyncAccessToken throws when unset', () => {
    expect(() => resolveSyncAccessToken()).toThrow('sync access token');
  });

  it('resolveSyncAccessToken uses MRSCRAPER_SYNC_ACCESS_TOKEN', () => {
    process.env.MRSCRAPER_SYNC_ACCESS_TOKEN = 'atk_env';
    expect(resolveSyncAccessToken()).toBe('atk_env');
  });

  it('normalizeBearerToken strips Bearer prefix', () => {
    expect(normalizeBearerToken('Bearer abc')).toBe('abc');
    expect(normalizeBearerToken('bearer abc')).toBe('abc');
  });
});
