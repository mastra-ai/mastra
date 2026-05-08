import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

const blockers: http.Server[] = [];

async function getFreePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await closeServer(server);
  if (!address || typeof address === 'string') throw new Error('Failed to allocate a test port');
  return address.port;
}

async function getTestPorts(): Promise<{ defaultPort: number; fallbackPort: number }> {
  return {
    defaultPort: await getFreePort(),
    fallbackPort: await getFreePort(),
  };
}

async function blockPort(port: number): Promise<void> {
  const server = http.createServer((_, res) => {
    res.statusCode = 200;
    res.end('blocked');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  blockers.push(server);
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

describe('OpenAI Codex OAuth callback port selection', () => {
  afterEach(async () => {
    while (blockers.length > 0) {
      const server = blockers.pop();
      if (server) await closeServer(server);
    }
  });

  it('uses the Codex default callback port first', async () => {
    const ports = await getTestPorts();
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.defaultPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('falls back to the Codex fallback port when the default is busy', async () => {
    const ports = await getTestPorts();
    await blockPort(ports.defaultPort);
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.fallbackPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('does not scan arbitrary callback ports after the Codex ports are busy', async () => {
    const ports = await getTestPorts();
    await blockPort(ports.defaultPort);
    await blockPort(ports.fallbackPort);
    const { __testing } = await import('./openai-codex.js');

    const server = await __testing.startLocalOAuthServer('state', ports);
    try {
      expect(server.redirectUri).toBe(`http://localhost:${ports.fallbackPort}/auth/callback`);
    } finally {
      server.close();
    }
  });

  it('uses the selected callback port in the authorization URL', async () => {
    const { __testing } = await import('./openai-codex.js');

    const { url } = await __testing.createAuthorizationFlow('http://localhost:1457/auth/callback', 'state');

    expect(new URL(url).searchParams.get('redirect_uri')).toBe('http://localhost:1457/auth/callback');
  });
});
