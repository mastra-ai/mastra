import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';

// Exercise the transport over HTTP, including the host-selected prefix and auth headers.
describe.each(['score', 'feedback'] as const)('single %s reads', field => {
  let client: MastraClient;
  let close: () => Promise<void>;
  let credentials: RequestCredentials | undefined;
  let requestPath: string | undefined;
  let authorization: string | undefined;
  let project: string | undefined;
  let status: number;
  let record: Record<string, unknown> | null;

  beforeEach(async () => {
    status = 200;
    record = null;
    credentials = undefined;
    const server = createServer((req, res) => {
      requestPath = req.url;
      authorization = req.headers.authorization;
      project = req.headers['x-mastra-project-id']?.toString();
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? { [field]: record } : { error: 'Forbidden' }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
    client = new MastraClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiPrefix: '/custom/api',
      headers: { authorization: 'Bearer test-token', 'x-mastra-project-id': 'project-1' },
      credentials: 'include',
      retries: 0,
      fetch: (input, init) => {
        credentials = init?.credentials;
        return fetch(input, init);
      },
    });
    close = () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });

  afterEach(async () => close());

  const get = (id: string) => (field === 'score' ? client.getScore(id) : client.getFeedback(id));

  it('encodes the ID and preserves the response, API prefix, credentials and headers', async () => {
    const id = 'id/with spaces?#%';
    record = { [`${field}Id`]: id, traceId: 'trace-1', timestamp: '2026-11-05T12:00:00.000Z' };
    expect(await get(id)).toEqual({ [field]: record });
    expect(requestPath).toBe(
      `/custom/api/observability/${field === 'score' ? 'scores' : 'feedback'}/${encodeURIComponent(id)}`,
    );
    expect(authorization).toBe('Bearer test-token');
    expect(project).toBe('project-1');
    expect(credentials).toBe('include');
  });

  it('preserves a missing record as null', async () => {
    expect(await get('missing')).toEqual({ [field]: null });
  });

  it('rejects a forbidden response', async () => {
    status = 403;
    await expect(get('private')).rejects.toThrow();
  });
});
