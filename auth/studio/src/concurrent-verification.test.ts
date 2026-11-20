import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MastraAuthStudio } from './index';

const SHARED_API_LATENCY_MS = 50;

const me = {
  user: { id: 'user-1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' },
  organizationId: 'org-1',
  role: 'admin',
  memberOrgIds: ['org-1', 'org-2'],
};

const orgs = {
  organizations: [
    { id: 'org-1', role: 'admin' },
    { id: 'org-2', role: 'member' },
  ],
};

let originalCwd: string;
let cwdWithoutProjectConfig: string;
let server: Server;
let sharedApiUrl: string;
let sharedApiCalls: string[] = [];

beforeAll(async () => {
  originalCwd = process.cwd();
  cwdWithoutProjectConfig = mkdtempSync(join(tmpdir(), 'mastra-auth-studio-concurrent-'));
  process.chdir(cwdWithoutProjectConfig);

  server = createServer((req, res) => {
    const cookie = req.headers.cookie ?? '';
    const path = req.url?.replace('/v1', '') ?? '';
    sharedApiCalls.push(`${path} ${cookie}`);
    setTimeout(() => {
      const expired = cookie === 'wos-session=sealed-expired';
      if (!expired && cookie !== 'wos-session=sealed-renewed') {
        res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (expired) headers['set-cookie'] = 'wos-session=sealed-renewed; Path=/; HttpOnly';
      res.writeHead(200, headers).end(JSON.stringify(path === '/auth/orgs' ? orgs : me));
    }, SHARED_API_LATENCY_MS);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  sharedApiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterEach(() => {
  sharedApiCalls = [];
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  process.chdir(originalCwd);
  rmSync(cwdWithoutProjectConfig, { recursive: true, force: true });
});

function pageRequest(cookie: string) {
  return new Request('http://localhost/web/factory/projects', { headers: { Cookie: cookie } });
}

describe('several requests from one page load with the same session cookie', () => {
  it('shares one renewal of an expired session and hands the renewed cookie to every response', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });
    const requests = Array.from({ length: 5 }, () => pageRequest('wos-session=sealed-expired'));

    const users = await Promise.all(requests.map(request => auth.authenticateToken('', request)));

    expect(users.map(user => user?.id)).toEqual(['user-1', 'user-1', 'user-1', 'user-1', 'user-1']);
    for (const request of requests) {
      expect(auth.consumePendingResponseHeaders(request)?.['Set-Cookie']).toContain('wos-session=sealed-renewed');
    }
    expect(sharedApiCalls).toEqual(['/auth/me wos-session=sealed-expired']);
  });

  it('asks the shared API once for a cookie it has not verified yet', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });

    await Promise.all(
      Array.from({ length: 10 }, () => auth.authenticateToken('', pageRequest('wos-session=sealed-renewed'))),
    );
    await auth.authenticateToken('', pageRequest('wos-session=sealed-renewed'));

    expect(sharedApiCalls).toEqual(['/auth/me wos-session=sealed-renewed']);
  });

  it('asks again for a cookie whose last check failed', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });

    expect(await auth.authenticateToken('', pageRequest('wos-session=revoked'))).toBeNull();
    expect(await auth.authenticateToken('', pageRequest('wos-session=revoked'))).toBeNull();

    expect(sharedApiCalls).toEqual(['/auth/me wos-session=revoked', '/auth/me wos-session=revoked']);
  });

  it('looks up the role in a pinned organization once, with the renewed cookie', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl, organizationId: 'org-2' });
    const requests = Array.from({ length: 4 }, () => pageRequest('wos-session=sealed-expired'));

    const users = await Promise.all(requests.map(request => auth.authenticateToken('', request)));

    expect(users.map(user => `${user?.organizationId}:${user?.role}`)).toEqual([
      'org-2:member',
      'org-2:member',
      'org-2:member',
      'org-2:member',
    ]);
    expect(sharedApiCalls).toEqual(['/auth/me wos-session=sealed-expired', '/auth/orgs wos-session=sealed-renewed']);
  });
});
