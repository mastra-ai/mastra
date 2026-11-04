/**
 * A page load sends several requests carrying the same session cookie at once.
 * These tests run the provider against a real HTTP server standing in for the
 * shared API, which (like WorkOS) refuses a refresh token once it has been used.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MastraAuthStudio } from './index';

const me = {
  user: { id: 'user-1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' },
  organizationId: 'org-1',
  role: 'admin',
  memberOrgIds: ['org-1'],
};

let originalCwd: string;
let scratchCwd: string;
let server: Server;
let sharedApiUrl: string;
let meCalls: string[] = [];

beforeAll(async () => {
  // Keep an ambient `.mastra-project.json` out of the constructor's config fallback.
  originalCwd = process.cwd();
  scratchCwd = mkdtempSync(join(tmpdir(), 'mastra-auth-studio-concurrent-'));
  process.chdir(scratchCwd);

  // `sealed-expired` holds an expired access token: the first call refreshes it
  // into `sealed-renewed` and later calls with it are refused, as WorkOS refuses
  // a used refresh token. `sealed-renewed` is valid.
  server = createServer((req, res) => {
    const cookie = req.headers.cookie ?? '';
    meCalls.push(cookie);
    // Counted on arrival: the first refresh with a token wins, later ones are refused.
    const firstUse = meCalls.filter(call => call === cookie).length === 1;
    setTimeout(() => {
      if (cookie === 'wos-session=sealed-renewed') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(me));
        return;
      }
      if (cookie === 'wos-session=sealed-expired' && firstUse) {
        res
          .writeHead(200, {
            'content-type': 'application/json',
            'set-cookie': 'wos-session=sealed-renewed; Path=/; HttpOnly',
          })
          .end(JSON.stringify(me));
        return;
      }
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }));
    }, 50);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  sharedApiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterEach(() => {
  meCalls = [];
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  process.chdir(originalCwd);
  rmSync(scratchCwd, { recursive: true, force: true });
});

function pageRequest(cookie: string) {
  return new Request('http://localhost/web/factory/projects', { headers: { Cookie: cookie } });
}

describe('several requests from one page load with the same session cookie', () => {
  it('keeps every request signed in when they arrive together with an expired session', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });
    const requests = Array.from({ length: 5 }, () => pageRequest('wos-session=sealed-expired'));

    const users = await Promise.all(requests.map(request => auth.authenticateToken('', request)));

    expect(users.map(user => user?.id)).toEqual(['user-1', 'user-1', 'user-1', 'user-1', 'user-1']);
    // The renewed cookie reaches the browser whichever response it reads first.
    for (const request of requests) {
      expect(auth.consumePendingResponseHeaders(request)?.['Set-Cookie']).toContain('wos-session=sealed-renewed');
    }
    expect(meCalls).toEqual(['wos-session=sealed-expired']);
  });

  it('asks the shared API once for a cookie it has not verified yet', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });

    await Promise.all(
      Array.from({ length: 10 }, () => auth.authenticateToken('', pageRequest('wos-session=sealed-renewed'))),
    );
    // Later requests within the cache window reuse the verification.
    await auth.authenticateToken('', pageRequest('wos-session=sealed-renewed'));

    expect(meCalls).toEqual(['wos-session=sealed-renewed']);
  });

  it('asks again for a cookie whose last check failed', async () => {
    const auth = new MastraAuthStudio({ sharedApiUrl });

    expect(await auth.authenticateToken('', pageRequest('wos-session=revoked'))).toBeNull();
    expect(await auth.authenticateToken('', pageRequest('wos-session=revoked'))).toBeNull();

    expect(meCalls).toEqual(['wos-session=revoked', 'wos-session=revoked']);
  });
});
