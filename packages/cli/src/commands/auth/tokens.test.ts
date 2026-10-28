import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// A real HTTP server stands in for the Platform token endpoint, so the request
// the CLI sends and the response it reads are the actual wire format.
let server: Server;
let lastBody: Record<string, unknown> | undefined;
let respond: (body: Record<string, unknown>) => Record<string, unknown>;
let revoked: string[];
let revokeStatus: number;

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      if (req.method === 'DELETE') {
        revoked.push(decodeURIComponent(req.url!.split('/').pop()!));
        res.writeHead(revokeStatus).end();
        return;
      }
      lastBody = raw ? JSON.parse(raw) : undefined;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(respond(lastBody ?? {})));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.MASTRA_PLATFORM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  delete process.env.MASTRA_PLATFORM_API_URL;
  await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
  lastBody = undefined;
  revoked = [];
  revokeStatus = 204;
  // Current Platform: echoes the permissions it minted the key with.
  respond = body => ({
    token: { id: 'api_key_1', name: body.name, permissions: body.permissions ?? [] },
    secret: 'sk_test_secret',
  });
});

describe('createToken', () => {
  it('mints a CI key that can manage databases', async () => {
    const { createToken } = await import('./tokens.js');

    const result = await createToken('tok', 'org_1', 'ci', ['databases:write']);

    expect(lastBody).toEqual({ name: 'ci', permissions: ['databases:write'] });
    expect(result).toEqual({ id: 'api_key_1', secret: 'sk_test_secret', permissions: ['databases:write'] });
  });

  it('mints a plain key exactly as before when no permission is asked for', async () => {
    const { createToken } = await import('./tokens.js');

    await createToken('tok', 'org_1', 'ci');

    expect(lastBody).toEqual({ name: 'ci' });
  });

  // An older Platform drops unknown fields, so it would mint a plain key and
  // report success; the CI job would then fail later with a 403.
  it('revokes the plain key and fails when Platform drops the permission', async () => {
    respond = body => ({ token: { id: 'api_key_1', name: body.name }, secret: 'sk_test_secret' });
    const { createToken } = await import('./tokens.js');

    await expect(createToken('tok', 'org_1', 'ci', ['databases:write'])).rejects.toThrow(
      /without databases:write.*revoked/s,
    );
    expect(revoked).toEqual(['api_key_1']);
  });

  it('prints the revoke command when revoking the plain key also fails', async () => {
    respond = body => ({ token: { id: 'api_key_1', name: body.name }, secret: 'sk_test_secret' });
    revokeStatus = 503;
    const { createToken } = await import('./tokens.js');

    await expect(createToken('tok', 'org_1', 'ci', ['databases:write'])).rejects.toThrow(
      /Revoking it also failed \(.+\).*mastra auth tokens revoke api_key_1/s,
    );
  });

  it('sends each permission once when the same one is passed twice', async () => {
    const { createToken } = await import('./tokens.js');

    await createToken('tok', 'org_1', 'ci', ['databases:write', 'databases:write']);

    expect(lastBody).toEqual({ name: 'ci', permissions: ['databases:write'] });
  });
});
