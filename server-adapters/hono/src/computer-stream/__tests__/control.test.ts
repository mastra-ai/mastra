import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ComputerControlSetter, ComputerControlSource } from '../index.js';
import { createStubMastra, startProxy } from './harness.js';

type Proxy = Awaited<ReturnType<typeof startProxy>>;
let proxy: Proxy | undefined;

afterEach(async () => {
  await proxy?.close();
  proxy = undefined;
});

function lease() {
  const state = { holder: 'agent' as 'agent' | 'human', attached: true };
  const scopes: unknown[] = [];
  const getControl = vi.fn<ComputerControlSource>(async (_id, scope) => {
    scopes.push(scope);
    if (!state.attached) throw new Error('computer not attached');
    return { holder: state.holder };
  });
  const setControl = vi.fn<ComputerControlSetter>(async (_id, scope, change) => {
    scopes.push(scope);
    if (!state.attached) throw new Error('computer not attached');
    const holder = change.action === 'take' ? 'human' : 'agent';
    if (holder === state.holder) return { holder, notified: false, reason: 'no-change' };
    state.holder = holder;
    return { holder, notified: true };
  });
  return { state, scopes, getControl, setControl };
}

async function start(options: Parameters<typeof startProxy>[0] = {}) {
  const l = lease();
  proxy = await startProxy({ getViewer: async () => null, getControl: l.getControl, setControl: l.setControl, ...options });
  return { ...proxy, lease: l };
}

const auth = { authorization: 'Bearer valid-token' };

function post(origin: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return fetch(`${origin}/api/computers/c1/control`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json', origin, ...headers },
    body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', ...body }),
  });
}

function get(origin: string, query = 'threadId=thread-1&resourceId=res-1', headers: Record<string, string> = {}) {
  return fetch(`${origin}/api/computers/c1/control?${query}`, { headers: { ...auth, ...headers } });
}

describe('control routes', () => {
  it('reads and changes the holder', async () => {
    const { origin, lease } = await start();
    const read = await get(origin);
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.json()).toEqual({ holder: 'agent' });

    const take = await post(origin, { action: 'take' });
    expect(await take.json()).toEqual({ holder: 'human', notified: true });
    expect(await (await get(origin)).json()).toEqual({ holder: 'human' });

    const again = await post(origin, { action: 'take' });
    expect(await again.json()).toEqual({ holder: 'human', notified: false, reason: 'no-change' });

    const back = await post(origin, { action: 'release', note: 'done' });
    expect(await back.json()).toEqual({ holder: 'agent', notified: true });
    expect(lease.setControl).toHaveBeenLastCalledWith(
      'c1',
      { threadId: 'thread-1', resourceId: 'res-1' },
      { action: 'release', note: 'done' },
    );
  });

  it('requires authentication', async () => {
    const { origin, lease } = await start();
    expect((await fetch(`${origin}/api/computers/c1/control?threadId=thread-1&resourceId=res-1`)).status).toBe(401);
    const res = await fetch(`${origin}/api/computers/c1/control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', action: 'take' }),
    });
    expect(res.status).toBe(401);
    expect(lease.getControl).not.toHaveBeenCalled();
    expect(lease.setControl).not.toHaveBeenCalled();
  });

  it('404s without detail when the computer is not attached to the thread', async () => {
    const { origin, lease } = await start();
    lease.state.attached = false;
    const read = await get(origin);
    expect(read.status).toBe(404);
    expect(await read.json()).toEqual({ error: 'not found' });
    const take = await post(origin, { action: 'take' });
    expect(take.status).toBe(404);
    expect(await take.json()).toEqual({ error: 'not found' });
  });

  it('rechecks the attachment on every request', async () => {
    const { origin, lease } = await start();
    expect((await post(origin, { action: 'take' })).status).toBe(200);
    lease.state.attached = false;
    expect((await post(origin, { action: 'release' })).status).toBe(404);
    expect((await get(origin)).status).toBe(404);
  });

  describe('csrf', () => {
    it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', ''])(
      'rejects content-type %j with 415 before any lookup',
      async contentType => {
        const getStorage = vi.fn();
        const mastra = createStubMastra();
        const original = mastra.getStorage.bind(mastra);
        (mastra as any).getStorage = (...args: []) => (getStorage(), original(...args));
        const { origin, lease } = await start({ mastra });
        const res = await fetch(`${origin}/api/computers/c1/control`, {
          method: 'POST',
          headers: { ...auth, origin, ...(contentType && { 'content-type': contentType }) },
          body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', action: 'take' }),
        });
        expect(res.status).toBe(415);
        expect(getStorage).not.toHaveBeenCalled();
        expect(lease.setControl).not.toHaveBeenCalled();
      },
    );

    it('accepts a JSON media type with parameters', async () => {
      const { origin } = await start();
      const res = await post(origin, { action: 'take' }, { 'content-type': 'application/json; charset=utf-8' });
      expect(res.status).toBe(200);
    });

    it('rejects a foreign origin before the thread, attachment or lease is touched', async () => {
      const threadLookups: string[] = [];
      const mastra = createStubMastra();
      const store = await mastra.getStorage()!.getStore('memory' as never);
      const original = (store as any).getThreadById;
      (store as any).getThreadById = async (args: { threadId: string }) => (threadLookups.push(args.threadId), original(args));
      (mastra as any).getStorage = () => ({ getStore: async () => store });
      const { origin, lease } = await start({ mastra, allowedOrigins: ['http://studio.test'] });
      for (const bad of ['http://evil.test', 'not a url', 'file://x']) {
        expect((await post(origin, { action: 'take' }, { origin: bad })).status).toBe(403);
        expect((await get(origin, undefined, { origin: bad })).status).toBe(403);
      }
      expect(threadLookups).toEqual([]);
      expect(lease.getControl).not.toHaveBeenCalled();
      expect(lease.setControl).not.toHaveBeenCalled();
      expect((await post(origin, { action: 'take' }, { origin: 'http://studio.test' })).status).toBe(200);
    });

    it('allows non-browser clients that send no Origin', async () => {
      const { origin } = await start();
      const res = await fetch(`${origin}/api/computers/c1/control`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', action: 'take' }),
      });
      expect(res.status).toBe(200);
    });
  });

  it('is forbidden without a memory store, without consulting the lease', async () => {
    const { origin, lease } = await start({ mastra: createStubMastra({ threads: null }) });
    expect((await get(origin)).status).toBe(403);
    expect((await post(origin, { action: 'take' })).status).toBe(403);
    expect(lease.getControl).not.toHaveBeenCalled();
    expect(lease.setControl).not.toHaveBeenCalled();
  });

  it('403s for an unknown thread (no existence leak) and for a thread of another resource', async () => {
    const mastra = createStubMastra({
      threads: [
        { id: 'thread-1', resourceId: 'res-1' },
        { id: 'thread-2', resourceId: 'res-2' },
      ],
    });
    const { origin, lease } = await start({ mastra });
    expect((await post(origin, { action: 'take', threadId: 'nope' })).status).toBe(403);
    expect((await post(origin, { action: 'take', threadId: 'thread-2' })).status).toBe(403);
    expect((await get(origin, 'threadId=thread-2&resourceId=res-1')).status).toBe(403);
    expect(lease.setControl).not.toHaveBeenCalled();
  });

  it('checks memory:read to read and memory:write to change', async () => {
    const checked: string[] = [];
    const fga = {
      check: async () => true,
      require: async (_user: unknown, { permission }: { permission: string }) => {
        checked.push(permission);
        if (permission === 'memory:write') throw Object.assign(new Error('denied'), { status: 403 });
      },
      filterAccessible: async (_u: unknown, items: unknown[]) => items,
    };
    const { origin, lease } = await start({ mastra: createStubMastra({ fga }) });
    expect((await get(origin)).status).toBe(200);
    expect((await post(origin, { action: 'take' })).status).toBe(403);
    expect(checked).toEqual(['memory:read', 'memory:write']);
    expect(lease.setControl).not.toHaveBeenCalled();
  });

  it.each([
    [{ action: 'drive' }, 400],
    [{ action: undefined }, 400],
    [{ action: 'take', note: 7 }, 400],
    [{ action: 'take', note: 'x'.repeat(501) }, 400],
    [{ action: 'take', threadId: undefined }, 400],
    [{ action: 'take', resourceId: undefined }, 400],
  ])('validates the body %j', async (body, status) => {
    const { origin, lease } = await start();
    expect((await post(origin, body)).status).toBe(status);
    expect(lease.setControl).not.toHaveBeenCalled();
  });

  it('accepts a 500-character note and drops an empty one', async () => {
    const { origin, lease } = await start();
    expect((await post(origin, { action: 'take', note: 'x'.repeat(500) })).status).toBe(200);
    expect((await post(origin, { action: 'release', note: '' })).status).toBe(200);
    expect(lease.setControl.mock.calls.at(-1)![2]).toEqual({ action: 'release' });
  });

  it('is not mounted without both lease callbacks', async () => {
    const l = lease();
    proxy = await startProxy({ getViewer: async () => null, getControl: l.getControl });
    const res = await post(proxy.origin, { action: 'take' });
    expect(res.status).toBe(404);
    expect(l.getControl).not.toHaveBeenCalled();
  });
});
