import { randomUUID } from 'node:crypto';

import type { Backend } from './types';

const API = process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474';

async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Toxiproxy ${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}

/** Each grid cell owns its proxy; real cache and transport connections both cross it. */
export async function createProxy(backend: Exclude<Backend, 'memory'>) {
  const name = `stream-harness-${backend}-${randomUUID()}`;
  const port = backend === 'redis' ? 8661 : 8663;
  // A busy listen port must fail, never delete another run's active proxy.
  await request('/proxies', 'POST', { name, listen: `0.0.0.0:${port}`, upstream: `${backend}:6379`, enabled: true });
  return {
    url: `${backend === 'redis' ? 'redis' : 'valkey'}://127.0.0.1:${port}`,
    async inject(kind: 'pause' | 'reset') {
      await request(`/proxies/${name}/toxics`, 'POST', {
        name: 'fault',
        type: kind === 'pause' ? 'timeout' : 'reset_peer',
        stream: 'downstream',
        toxicity: 1,
        attributes: { timeout: 0 },
      });
    },
    async recover() {
      await request(`/proxies/${name}/toxics/fault`, 'DELETE');
    },
    async close() {
      await request(`/proxies/${name}`, 'DELETE');
    },
  };
}
