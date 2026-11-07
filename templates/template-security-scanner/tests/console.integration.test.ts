import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import { startControlPlane } from '../src/http/server.js';

const bootstrap = 'owned_test_bootstrap_secret_longer_than_32_characters';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function startConsole() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-console-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, 'web', 'dist');
  await mkdir(folder, { recursive: true });
  const script = Buffer.from('document.documentElement.dataset.console="loaded";');
  const style = Buffer.from('body{background:#101114}');
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const manifest = { script: `console-${hash(script)}.js`, style: `style-${hash(style)}.css` };
  await Promise.all([
    writeFile(join(folder, manifest.script), script),
    writeFile(join(folder, manifest.style), style),
    writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest)),
  ]);
  const settings = loadSettings({ CONTROL_BOOTSTRAP_SECRET: bootstrap, SCANNER_ENCRYPTION_KEY: 'ab'.repeat(32) }, root);
  const server = await startControlPlane(settings, 0);
  cleanup.push(server.close);
  return { url: server.url, manifest };
}

describe('local console HTTP boundary', () => {
  // J-F6-002: A browser can load the login shell, but cannot read operations until it has a session.
  it('serves only verified public assets and recovers the active CSRF token after reload', async () => {
    const { url, manifest } = await startConsole();
    const shell = await fetch(url);
    expect(shell.status).toBe(200);
    expect(shell.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(shell.headers.get('x-frame-options')).toBe('DENY');
    const html = await shell.text();
    expect(html).toContain(`/assets/${manifest.script}`);
    expect(html).toContain(`/assets/${manifest.style}`);
    expect(html).not.toContain(bootstrap);
    const asset = await fetch(`${url}/assets/${manifest.script}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await fetch(`${url}/assets/console-${'0'.repeat(64)}.js`)).status).toBe(404);
    expect((await fetch(`${url}/api/findings`)).status).toBe(403);
    expect((await fetch(`${url}/native/agents`)).status).toBe(403);

    const issued = await fetch(`${url}/api/session`, {
      method: 'POST',
      headers: { origin: url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: bootstrap }),
    });
    expect(issued.status).toBe(201);
    const first = await issued.json();
    const cookie = issued.headers.get('set-cookie')?.split(';')[0];
    expect(cookie).toBeTruthy();
    const active = await fetch(`${url}/api/session`, { headers: { cookie: cookie! } });
    expect(active.status).toBe(200);
    expect(active.headers.get('cache-control')).toBe('no-store');
    expect(await active.json()).toEqual(first);
    expect((await fetch(`${url}/api/session`)).status).toBe(403);
    const forbiddenHost = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        `${url}/api/settings`,
        { headers: { host: 'untrusted.example', cookie: cookie! } },
        response => {
          response.resume();
          response.on('end', () => resolve(response.statusCode ?? 0));
        },
      );
      request.on('error', reject);
      request.end();
    });
    expect(forbiddenHost).toBe(403);
  });

  // J-F6-002: Projected reads remain bounded and a failed mutation leaves persisted state unchanged.
  it('returns empty operational projections without secrets and rejects stale CSRF mutations', async () => {
    const { url } = await startConsole();
    const issued = await fetch(`${url}/api/session`, {
      method: 'POST',
      headers: { origin: url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: bootstrap }),
    });
    const session = await issued.json();
    const cookie = issued.headers.get('set-cookie')!.split(';')[0]!;
    const headers = { cookie, origin: url };
    const reads = await Promise.all(
      ['/api/settings', '/api/agents', '/api/findings?limit=1&offset=0', '/api/evaluations?limit=1&offset=0'].map(
        path => fetch(`${url}${path}`, { headers }),
      ),
    );
    expect(reads.map(response => response.status)).toEqual([200, 200, 200, 200]);
    const bodies = await Promise.all(reads.map(response => response.text()));
    expect(bodies.join(' ')).not.toContain(bootstrap);
    expect(bodies[1]).toContain('"runs":[]');
    expect(bodies[2]).toContain('"items":[]');
    expect(bodies[3]).toContain('"items":[]');
    expect((await fetch(`${url}/api/findings?limit=101`, { headers })).status).toBe(400);
    expect((await fetch(`${url}/api/targets/${randomUUID()}/recurrence`, { headers })).status).toBe(404);
    const denied = await fetch(`${url}/api/policies`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json', 'x-csrf-token': 'invalid' },
      body: JSON.stringify({
        name: 'Denied',
        permittedMethods: ['GET'],
        scanLimits: { maxRequests: 1, maxDurationSeconds: 1, maxResponseBytes: 1024, maxConcurrency: 1 },
      }),
    });
    expect(denied.status).toBe(403);
    const policies = await fetch(`${url}/api/policies`, { headers });
    expect(await policies.json()).toMatchObject({ items: [] });
    const closed = await fetch(`${url}/api/session`, {
      method: 'DELETE',
      headers: { ...headers, 'x-csrf-token': session.csrfToken },
    });
    expect(closed.status).toBe(204);
    expect((await fetch(`${url}/api/session`, { headers })).status).toBe(403);
  });
});
