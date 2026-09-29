import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { AdmissionError } from '../examples/editorial-review/admission.js';

const calls = vi.hoisted(() => ({ starts: 0 }));
vi.mock('../examples/editorial-review/provider.js', () => ({ provider: { store: { get: async () => null } } }));
vi.mock('../examples/editorial-review/mastra.js', () => ({}));
vi.mock('../examples/editorial-review/workflow.js', async () => {
  const { z } = await import('zod');
  return {
    inputSchema: z.object({ draft: z.string().min(1) }),
    reviewMode: 'deterministic',
    editorialReview: {
      id: 'test',
      createRun: async () => ({
        startAsync: async () => {
          calls.starts++;
          return { runId: 'new' };
        },
      }),
    },
  };
});
import { createExampleServer } from '../examples/editorial-review/http.js';

afterEach(() => {
  calls.starts = 0;
});
it('rejects admission before any workflow submission and returns retry guidance', async () => {
  // Cast keeps this regression executable against the old one-argument server.
  const create = createExampleServer as (...args: unknown[]) => ReturnType<typeof createExampleServer>;
  const server = create(
    { alice: 'a-valid-local-test-token' },
    {
      reserve: async () => {
        throw new AdmissionError(429, 'Limit reached', 60);
      },
      close: async () => {},
    },
  );
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/jobs`, {
      method: 'POST',
      headers: { authorization: 'Bearer a-valid-local-test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'Synthetic quota test' }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(calls.starts).toBe(0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
