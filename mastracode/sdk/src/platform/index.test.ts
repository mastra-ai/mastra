import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loginToPlatform, resolveFactoryUrl } from './index';
import type { PlatformEnvironment } from './index';

const env = (overrides: Partial<PlatformEnvironment>): PlatformEnvironment => ({
  id: 'e1',
  projectId: 'p1',
  name: 'production',
  slug: 'production',
  type: 'production',
  instanceUrl: null,
  customServerUrl: null,
  ...overrides,
});

describe('resolveFactoryUrl', () => {
  it('prefers the custom server URL and normalizes it', () => {
    expect(resolveFactoryUrl(env({ instanceUrl: 'a.mastra.cloud', customServerUrl: 'https://my.host/' }))).toBe(
      'https://my.host',
    );
  });

  it('uses the managed factory domain for deployed environments and returns null when undeployed', () => {
    expect(
      resolveFactoryUrl(env({ slug: 'shipyard', instanceUrl: 'https://shipyard-production-f6d6.up.railway.app' })),
    ).toBe('https://shipyard.factory.mastra.cloud');
    expect(resolveFactoryUrl(env({}))).toBeNull();
  });
});

describe('resolveFactoryUrl custom servers', () => {
  it('keeps the base path and adds https to a bare host', () => {
    expect(resolveFactoryUrl(env({ customServerUrl: 'my.host/factory/' }))).toBe('https://my.host/factory');
  });

  it('rejects non-HTTPS and malformed custom server URLs', () => {
    expect(resolveFactoryUrl(env({ customServerUrl: 'http://my.host' }))).toBeNull();
    expect(resolveFactoryUrl(env({ customServerUrl: 'ftp://my.host' }))).toBeNull();
    expect(resolveFactoryUrl(env({ customServerUrl: 'https://' }))).toBeNull();
  });
});

describe('loginToPlatform', () => {
  it('completes the browser callback and saves credentials', async () => {
    const credentialsPath = join(await mkdtemp(join(tmpdir(), 'mc-platform-')), 'credentials.json');
    const user = { id: 'u1', email: 'a@b.c', firstName: null, lastName: null };

    const creds = await loginToPlatform({
      credentialsPath,
      openUrl: url => {
        const { searchParams } = new URL(url);
        const cb = new URL(`http://127.0.0.1:${searchParams.get('cli_port')}/callback`);
        cb.searchParams.set('state', searchParams.get('state')!);
        cb.searchParams.set('token', 'tok');
        cb.searchParams.set('refresh_token', 'ref');
        cb.searchParams.set('org', 'org1');
        cb.searchParams.set('user', encodeURIComponent(JSON.stringify(user)));
        void fetch(cb);
      },
    });

    expect(creds).toEqual({ token: 'tok', refreshToken: 'ref', user, organizationId: 'org1' });
    expect(JSON.parse(await readFile(credentialsPath, 'utf-8'))).toEqual(creds);
  });

  it('rejects a callback with a mismatched state', async () => {
    const controller = new AbortController();
    const result = loginToPlatform({
      signal: controller.signal,
      credentialsPath: join(tmpdir(), 'unused.json'),
      openUrl: async url => {
        const port = new URL(url).searchParams.get('cli_port');
        const res = await fetch(`http://127.0.0.1:${port}/callback?state=bad&token=t&org=o&user=%7B%7D`);
        expect(res.status).toBe(400);
        controller.abort();
      },
    });
    await expect(result).rejects.toThrow('Login cancelled');
  });
});
