import { afterEach, describe, expect, it } from 'vitest';

import { credentialsFromEnv, guardUrl, redact, registerSensitive, resetSensitiveForTests } from './env';

const GOOD = 'https://gyiixsk9we.us-central1.gcp.clickhouse.cloud:8443';

describe('guardUrl', () => {
  it('accepts only the approved replica and strips userinfo', () => {
    expect(guardUrl(GOOD)).toBe(GOOD);
    expect(guardUrl(`${GOOD}/`)).toBe(GOOD);
    expect(guardUrl('https://user:pw@gyiixsk9we.us-central1.gcp.clickhouse.cloud:8443')).toBe(GOOD);
  });

  it.each([
    'https://ijwqa4hihv.us-central1.gcp.clickhouse.cloud:8443',
    'https://IJWQA4HIHV.us-central1.gcp.clickhouse.cloud:8443',
    `${GOOD}/?x=ijwqa4hihv`,
    'https://gyiixsk9we.us-central1.gcp.clickhouse.cloud.ijwqa4hihv.example:8443',
  ])('refuses anything mentioning the production primary: %s', url => {
    expect(() => guardUrl(url)).toThrow(/production primary/);
  });

  it.each([
    ['http://gyiixsk9we.us-central1.gcp.clickhouse.cloud:8443', /https/],
    ['https://gyiixsk9we.us-central1.gcp.clickhouse.cloud', /port/],
    ['https://gyiixsk9we.us-central1.gcp.clickhouse.cloud:9440', /port/],
    ['https://other.us-central1.gcp.clickhouse.cloud:8443', /host/],
    ['https://gyiixsk9we.us-central1.gcp.clickhouse.cloud.evil.com:8443', /host/],
    ['https://localhost:8443', /host/],
    [`${GOOD}/db`, /path/],
    ['not a url', /valid URL/],
  ])('refuses %s', (url, message) => {
    expect(() => guardUrl(url)).toThrow(message);
  });

  it('never echoes the URL in the error', () => {
    const url = 'https://secret-user:secret-pass@other.example:8443';
    try {
      guardUrl(url);
    } catch (error) {
      expect(String(error)).not.toContain('secret');
      expect(String(error)).not.toContain('other.example');
    }
  });
});

describe('credentialsFromEnv', () => {
  it('requires all three values', () => {
    expect(() => credentialsFromEnv({ BENCH_CLICKHOUSE_URL: GOOD, BENCH_CLICKHOUSE_USER: 'u' })).toThrow(
      /must all be set/,
    );
  });

  it('rejects a non-identifier database', () => {
    expect(() =>
      credentialsFromEnv({
        BENCH_CLICKHOUSE_URL: GOOD,
        BENCH_CLICKHOUSE_USER: 'u',
        BENCH_CLICKHOUSE_PASSWORD: 'p',
        BENCH_CLICKHOUSE_DATABASE: 'db; DROP',
      }),
    ).toThrow(/identifier/);
  });

  it('ignores CLICKHOUSE_* variables', () => {
    expect(() => credentialsFromEnv({ CLICKHOUSE_URL: GOOD, CLICKHOUSE_PASSWORD: 'p' })).toThrow(/must all be set/);
  });
});

describe('redact', () => {
  afterEach(() => resetSensitiveForTests());

  it('redacts registered values, their URL encoding, and userinfo', () => {
    registerSensitive(['hunter2-password', 'p@ss/word', 'org_123456']);
    const text = 'auth hunter2-password p%40ss%2Fword https://bob:x@h.example org_123456';
    const out = redact(text);
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('p%40ss');
    expect(out).not.toContain('bob:x');
    expect(out).not.toContain('org_123456');
  });

  it('replaces longer secrets before shorter ones they contain', () => {
    registerSensitive(['abcd', 'abcdefgh']);
    expect(redact('abcdefgh')).toBe('[REDACTED]');
  });
});
