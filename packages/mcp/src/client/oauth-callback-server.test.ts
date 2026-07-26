/**
 * Tests for the loopback OAuth callback server.
 *
 * Uses real HTTP requests against the bound port — no mocks — since the
 * helper's whole job is correct socket-level behavior (binding, fallback,
 * one-shot semantics, releasing the port).
 */

import { createServer } from 'node:http';
import type * as NodeHttp from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { connect } from 'node:net';
import type { Socket } from 'node:net';

import { describe, it, expect, afterEach, vi } from 'vitest';

// Track every HTTP server the callback helper creates so a test can reach the
// bound instance and emit a post-bind 'error' on it.
const createdServers: HttpServer[] = [];
vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof NodeHttp>('node:http');
  return {
    ...actual,
    createServer: (...args: Parameters<typeof actual.createServer>) => {
      const server = actual.createServer(...args);
      createdServers.push(server);
      return server;
    },
  };
});

import type { OAuthCallbackServer } from './oauth-callback-server.js';
import { createOAuthCallbackServer, getCallbackUrlCandidates } from './oauth-callback-server.js';

const STATE = 'expected-state';

/**
 * Finds a port that is currently free by binding an ephemeral port and
 * releasing it. Keeps tests independent of hardcoded port availability.
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to probe for a free port'));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

function occupyPort(port: number): Promise<HttpServer> {
  return new Promise((resolve, reject) => {
    const blocker = createServer();
    blocker.once('error', reject);
    blocker.listen(port, '127.0.0.1', () => resolve(blocker));
  });
}

function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

describe('getCallbackUrlCandidates', () => {
  it('returns the preferred URL followed by sequential fallback ports', () => {
    const candidates = getCallbackUrlCandidates('http://127.0.0.1:5533/oauth/callback');

    expect(candidates).toHaveLength(11);
    expect(candidates[0]!.toString()).toBe('http://127.0.0.1:5533/oauth/callback');
    expect(candidates.map(url => Number(url.port))).toEqual([
      5533, 5534, 5535, 5536, 5537, 5538, 5539, 5540, 5541, 5542, 5543,
    ]);
    expect(candidates.every(url => url.pathname === '/oauth/callback')).toBe(true);
  });

  it('stops the fallback range at the maximum valid port', () => {
    // URL.port silently ignores out-of-range assignments, so without the cap
    // the overflowing candidates would keep the previous (duplicate) port.
    const candidates = getCallbackUrlCandidates('http://127.0.0.1:65533/oauth/callback');

    expect(candidates.map(url => Number(url.port))).toEqual([65533, 65534, 65535]);
  });
});

describe('createOAuthCallbackServer', () => {
  let callbackServer: OAuthCallbackServer | undefined;

  afterEach(async () => {
    await callbackServer?.close().catch(() => {});
    callbackServer = undefined;
  });

  async function startCallbackServer(): Promise<OAuthCallbackServer> {
    const port = await getFreePort();
    callbackServer = await createOAuthCallbackServer({
      redirectUrl: `http://127.0.0.1:${port}/oauth/callback`,
      state: STATE,
    });
    return callbackServer;
  }

  it('captures the authorization code from the callback request', async () => {
    const server = await startCallbackServer();

    const pending = server.waitForCode();
    const response = await fetch(`${server.url}?code=auth-code-123&state=${STATE}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('close this tab');
    expect(body).not.toContain('auth-code-123');
    await expect(pending).resolves.toEqual({ code: 'auth-code-123', state: STATE });
  });

  it('ignores requests without a matching state so they cannot settle the flow', async () => {
    const server = await startCallbackServer();
    const pending = server.waitForCode();

    // Neither a forged code nor a forged denial (the state authenticates the
    // redirect) may settle the pending flow.
    const forgedCode = await fetch(`${server.url}?code=forged-code&state=wrong-state`);
    expect(forgedCode.status).toBe(400);
    const forgedDenial = await fetch(`${server.url}?error=access_denied`);
    expect(forgedDenial.status).toBe(400);

    const genuine = await fetch(`${server.url}?code=auth-code-123&state=${STATE}`);
    expect(genuine.status).toBe(200);
    await expect(pending).resolves.toEqual({ code: 'auth-code-123', state: STATE });
  });

  it('rejects on a state-matching OAuth error response, including the description', async () => {
    const server = await startCallbackServer();

    const pending = expect(server.waitForCode()).rejects.toThrow(/access_denied.*User denied the request/);
    const response = await fetch(
      `${server.url}?error=access_denied&error_description=${encodeURIComponent('User denied the request')}&state=${STATE}`,
    );

    expect(response.status).toBe(400);
    await pending;
  });

  it('rejects when no callback arrives before the timeout', async () => {
    const server = await startCallbackServer();

    await expect(server.waitForCode({ timeoutMs: 50 })).rejects.toThrow(/Timed out waiting for OAuth callback/);
  });

  it('is one-shot: subsequent callback requests receive 410', async () => {
    const server = await startCallbackServer();

    const pending = server.waitForCode();
    await fetch(`${server.url}?code=auth-code-123&state=${STATE}`);
    await pending;

    const replay = await fetch(`${server.url}?code=another-code&state=${STATE}`);
    expect(replay.status).toBe(410);
  });

  it('rejects pending waitForCode when closed before a code arrives', async () => {
    const server = await startCallbackServer();

    const pending = server.waitForCode();
    await server.close();

    await expect(pending).rejects.toThrow(/closed before receiving an authorization code/);
  });

  it('falls back to the next port when the preferred port is in use', async () => {
    const preferredPort = await getFreePort();
    const blocker = await occupyPort(preferredPort);

    try {
      callbackServer = await createOAuthCallbackServer({
        redirectUrl: `http://127.0.0.1:${preferredPort}/oauth/callback`,
        state: STATE,
      });

      expect(callbackServer.port).toBe(preferredPort + 1);
      expect(callbackServer.url.toString()).toBe(`http://127.0.0.1:${preferredPort + 1}/oauth/callback`);
    } finally {
      await closeServer(blocker);
    }
  });

  it('binds the hostname from the redirect URL', async () => {
    const port = await getFreePort();
    callbackServer = await createOAuthCallbackServer({
      redirectUrl: `http://localhost:${port}/oauth/callback`,
      state: STATE,
    });

    const pending = callbackServer.waitForCode();
    const response = await fetch(`http://localhost:${port}/oauth/callback?code=auth-code-123&state=${STATE}`);

    expect(response.status).toBe(200);
    await expect(pending).resolves.toEqual({ code: 'auth-code-123', state: STATE });
  });

  it('releases the port on close', async () => {
    const server = await startCallbackServer();
    const { port } = server;

    await server.close();
    callbackServer = undefined;

    const reclaimed = await occupyPort(port);
    await closeServer(reclaimed);
  });

  it('releases the port on close despite an idle keep-alive connection', async () => {
    const server = await startCallbackServer();
    const { port } = server;

    // Complete the flow over a raw socket that stays open afterwards, the way
    // a browser holds the callback connection alive after the response.
    const socket = await new Promise<Socket>((resolve, reject) => {
      const client = connect(port, '127.0.0.1', () => resolve(client));
      client.once('error', reject);
    });
    try {
      const pending = server.waitForCode();
      socket.write(
        `GET /oauth/callback?code=auth-code-123&state=${STATE} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: keep-alive\r\n\r\n`,
      );
      await pending;

      // close() must not wait for the keep-alive socket's timeout to release
      // the port; without closeIdleConnections this close() hangs.
      await server.close();
      callbackServer = undefined;

      const reclaimed = await occupyPort(port);
      await closeServer(reclaimed);
    } finally {
      socket.destroy();
    }
  });

  it('settles the flow instead of crashing when the server errors after binding', async () => {
    const port = await getFreePort();
    createdServers.length = 0;
    callbackServer = await createOAuthCallbackServer({
      redirectUrl: `http://127.0.0.1:${port}/oauth/callback`,
      state: STATE,
    });

    const boundServer = createdServers.at(-1)!;
    expect(boundServer).toBeDefined();
    // The bind-time listeners are once()-based and self-remove, so after bind
    // the server has no 'error' listener. Emitting one with no handler would
    // throw and crash the host process; the persistent listener must absorb it
    // and reject the pending waitForCode instead.
    const pending = callbackServer.waitForCode();
    boundServer.emit('error', new Error('post-bind socket failure'));

    await expect(pending).rejects.toThrow(/post-bind socket failure/);
  });
});
