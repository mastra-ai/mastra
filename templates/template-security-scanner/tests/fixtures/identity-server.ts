import { createServer } from 'node:http';

/** Start the owned HTTP identity fixture and expose its requests and shutdown operation. */
export async function startIdentityFixture() {
  const accounts = new Map<string, { identity: string; role: string }>();
  const observations: { method: string; path: string; identity: string | null }[] = [];
  let mode: 'normal' | 'redirect' | 'malformed' | 'oversized' | 'failure' | 'timeout' = 'normal';
  let beforeResponse: (() => Promise<void>) | undefined;
  const server = createServer((request, response) => {
    void (async () => {
      if (beforeResponse) await beforeResponse();
      const credential =
        request.headers.authorization?.replace(/^Bearer /, '') ??
        request.headers['x-test-identity'] ??
        request.headers.cookie;
      const identity = typeof credential === 'string' ? (accounts.get(credential) ?? null) : null;
      observations.push({
        method: request.method ?? '',
        path: request.url ?? '',
        identity: identity?.identity ?? null,
      });
      const send = (status: number, body: string, headers: Record<string, string> = {}) => {
        response.writeHead(status, { 'content-type': 'application/json', ...headers });
        response.end(body);
      };
      if (request.method !== 'GET' || request.url !== '/identity') {
        send(405, '{}');
        return;
      }
      if (mode === 'redirect') {
        send(302, '{}', { location: 'http://127.0.0.1:1/forbidden' });
        return;
      }
      if (mode === 'malformed') {
        send(200, 'invalid-json-marker');
        return;
      }
      if (mode === 'oversized') {
        send(200, 'x'.repeat(8192));
        return;
      }
      if (mode === 'failure') {
        send(503, '{"error":"private-fixture-error"}');
        return;
      }
      if (mode === 'timeout') return;
      send(identity ? 200 : 401, identity ? JSON.stringify(identity) : '{}');
    })().catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture did not listen');
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    accounts,
    observations,
    setMode(value: typeof mode) {
      mode = value;
    },
    pause(handler?: () => Promise<void>) {
      beforeResponse = handler;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    },
  };
}
