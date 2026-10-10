import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({
  order: [] as string[],
  started: () => {},
  gate: Promise.resolve(),
  server: undefined as Server | undefined,
}));
vi.mock('../examples/editorial-review/http.js', async () => {
  const { createServer } = await import('node:http');
  return {
    createExampleServer: () => {
      lifecycle.server = createServer(async (_request, response) => {
        lifecycle.started();
        await lifecycle.gate;
        response.writeHead(lifecycle.order.length ? 503 : 200);
        response.end('request completed');
      });
      return lifecycle.server;
    },
  };
});
vi.mock('../examples/editorial-review/provider.js', () => ({
  persistence: {
    close: async () => {
      lifecycle.order.push('persistence');
    },
  },
  storage: {
    close: async () => {
      lifecycle.order.push('storage');
    },
  },
  provider: { getRun: async () => null },
}));
vi.mock('../examples/editorial-review/workflow.js', () => ({ editorialReview: { id: 'shutdown-test' } }));
vi.mock('../examples/editorial-review/admission.js', () => ({
  admissionLimitsFromEnv: () => ({}),
  createAdmission: () => ({
    close: async () => {
      lifecycle.order.push('admission');
    },
  }),
}));

it('drains an in-flight HTTP request before closing storage, even on repeated signals', async () => {
  vi.stubEnv('PORT', '0');
  vi.stubEnv('HOST', '127.0.0.1');
  vi.stubEnv('DEMO_API_TOKENS', '{"test":"a-valid-local-test-token"}');
  const signals = ['SIGINT', 'SIGTERM'] as const;
  const prior = new Map(signals.map(signal => [signal, process.listeners(signal)]));
  let release!: () => void;
  lifecycle.gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const started = new Promise<void>(resolve => {
    lifecycle.started = resolve;
  });
  let request: Promise<Response> | undefined;
  try {
    await import('../examples/editorial-review/server.js');
    const server = lifecycle.server!;
    if (!server.listening) await once(server, 'listening');
    request = fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/jobs`, {
      headers: { connection: 'close' },
    });
    await started;
    for (const signal of [...signals].reverse()) {
      const added = process.listeners(signal).filter(listener => !prior.get(signal)!.includes(listener));
      expect(added).toHaveLength(1);
      added[0]!(signal);
    }
    await new Promise(resolve => setImmediate(resolve));
    expect(lifecycle.order).toEqual([]);
    release();
    const response = await request;
    expect(response.status).toBe(200);
    await response.text();
    await vi.waitFor(() => expect(lifecycle.order).toEqual(['admission', 'persistence', 'storage']));
  } finally {
    release();
    await request?.then(response => (response.bodyUsed ? undefined : response.text()));
    if (lifecycle.server?.listening) await new Promise<void>(resolve => lifecycle.server!.close(() => resolve()));
    for (const signal of signals)
      for (const listener of process.listeners(signal))
        if (!prior.get(signal)!.includes(listener)) process.removeListener(signal, listener);
    vi.unstubAllEnvs();
  }
});
