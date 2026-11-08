import { afterEach, describe, expect, it } from 'vitest';
import { startProxy } from './harness.js';

let proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
afterEach(async () => { await proxy?.close(); proxy = undefined; });

describe('computer JSON routes', () => {
  it('are not mounted by the Hono WebSocket adapter', async () => {
    proxy = await startProxy();
    expect((await fetch(`${proxy.origin}/api/computers/c1/session`, { method: 'POST' })).status).toBe(404);
    expect((await fetch(`${proxy.origin}/api/computers/c1/control`)).status).toBe(404);
    expect((await fetch(`${proxy.origin}/api/computers/c1/control`, { method: 'POST' })).status).toBe(404);
  });
});
