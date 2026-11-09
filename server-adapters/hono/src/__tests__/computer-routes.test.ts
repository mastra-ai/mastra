import { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { configureComputerServer, InMemoryComputerTicketStore } from '@mastra/server/computer-stream';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index.js';

const auth: MastraAuthConfig = {
  authenticateToken: async token => (token === 'valid-token' ? { id: 'user-1' } : null),
  mapUserToResourceId: () => 'res-1',
};
const authorized = { authorization: 'Bearer valid-token' };

type ComputerState = {
  attached: boolean;
  running: boolean;
  holder: 'agent' | 'human';
  revision: number;
};

async function setup(options: {
  computers?: boolean;
  control?: boolean;
  storage?: boolean;
  fga?: unknown;
  allowedOrigins?: string | string[];
  configured?: boolean;
} = {}) {
  const state: ComputerState = { attached: true, running: true, holder: 'agent', revision: 0 };
  const viewer = vi.fn(async () => {
    if (!state.attached) throw new Error('not attached');
    return state.running ? { url: 'https://viewer.test/vnc.html', headers: { cookie: 'secret' } } : null;
  });
  const controlState = vi.fn(async () => {
    if (!state.attached) throw new Error('not attached');
    return { holder: state.holder, revision: state.revision };
  });
  const control = vi.fn(async (_id, _scope, change: { action: 'take' | 'release'; note?: string }) => {
    if (!state.attached) throw new Error('not attached');
    state.holder = change.action === 'take' ? 'human' : 'agent';
    state.revision += 1;
    return { holder: state.holder, revision: state.revision, notified: true };
  });
  const computers =
    options.computers === false
      ? undefined
      : {
          tools: () => ({}),
          viewer,
          ...(options.control === false ? {} : { controlState, control }),
        };
  const storage = options.storage === false ? undefined : new InMemoryStore();
  const mastra = new Mastra({
    logger: false,
    ...(storage ? { storage } : {}),
    ...(computers ? { computers } : {}),
    server: { auth, ...(options.fga ? { fga: options.fga as never } : {}) },
  });
  if (storage) {
    const memory = await storage.getStore('memory');
    const now = new Date();
    await memory?.saveThread({
      thread: { id: 'thread-1', resourceId: 'res-1', title: '', createdAt: now, updatedAt: now },
    });
    await memory?.saveThread({
      thread: { id: 'thread-2', resourceId: 'res-2', title: '', createdAt: now, updatedAt: now },
    });
  }
  const ticketStore = new InMemoryComputerTicketStore();
  if (options.configured !== false) {
    configureComputerServer(mastra, { ticketStore, allowedOrigins: options.allowedOrigins });
  }
  const app = new Hono();
  await new MastraServer({ app, mastra, prefix: '/api' }).init();
  return { app, mastra, state, viewer, controlState, control, ticketStore };
}

function session(app: Hono, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return app.request('http://localhost/api/computers/c1/session', {
    method: 'POST',
    headers: { ...authorized, 'content-type': 'application/json', origin: 'http://localhost', ...headers },
    body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'control', ...body }),
  });
}

function getControl(
  app: Hono,
  query = 'threadId=thread-1&resourceId=res-1',
  headers: Record<string, string> = authorized,
) {
  return app.request(`http://localhost/api/computers/c1/control?${query}`, { headers });
}

function changeControl(
  app: Hono,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request('http://localhost/api/computers/c1/control', {
    method: 'POST',
    headers: { ...authorized, 'content-type': 'application/json', origin: 'http://localhost', ...headers },
    body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', action: 'take', ...body }),
  });
}

describe('registered computer routes', () => {
  it('requires authentication before viewer or control side effects', async () => {
    const { app, viewer, controlState, control } = await setup();
    expect((await app.request('http://localhost/api/computers/c1/session', { method: 'POST' })).status).toBe(401);
    expect((await getControl(app, undefined, {})).status).toBe(401);
    expect((await changeControl(app, {}, { authorization: '' })).status).toBe(401);
    expect(viewer).not.toHaveBeenCalled();
    expect(controlState).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
  });

  it('mints a concealed ticket for an attached running computer and reports viewer-null as not-running', async () => {
    const { app, state, ticketStore } = await setup();
    const ready = await session(app);
    expect(ready.status).toBe(200);
    const body = (await ready.json()) as { state: string; socketUrl: string };
    expect(body.state).toBe('ready');
    expect(body.socketUrl).toMatch(/^\/computer\/c1\/websockify\?ticket=[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(body)).not.toContain('secret');
    const ticket = new URL(body.socketUrl, 'http://localhost').searchParams.get('ticket')!;
    await expect(ticketStore.consume(ticket, 'c1')).resolves.toMatchObject({ studioOrigin: 'http://localhost' });
    state.running = false;
    await expect((await session(app)).json()).resolves.toEqual({ state: 'not-running' });
  });

  it('conceals unattached computers, unknown threads, and resource mismatches as not found', async () => {
    const { app, state, viewer, control } = await setup();
    state.attached = false;
    expect((await session(app)).status).toBe(404);
    expect((await getControl(app)).status).toBe(404);
    expect((await changeControl(app)).status).toBe(404);
    expect(control).toHaveBeenCalledTimes(1);
    expect(viewer).toHaveBeenCalledTimes(1);
    viewer.mockClear();
    control.mockClear();
    state.attached = true;
    expect((await session(app, { threadId: 'missing' })).status).toBe(404);
    expect((await session(app, { resourceId: 'res-2' })).status).toBe(404);
    expect((await getControl(app, 'threadId=thread-2&resourceId=res-1')).status).toBe(404);
    expect(control).not.toHaveBeenCalled();
    expect(viewer).not.toHaveBeenCalled();
  });

  it('returns not found when route state, computers, storage, or control callbacks are unavailable', async () => {
    const unconfigured = await setup({ configured: false });
    expect((await session(unconfigured.app)).status).toBe(404);
    expect((await getControl(unconfigured.app)).status).toBe(404);
    expect((await session((await setup({ computers: false })).app)).status).toBe(404);
    const noStorage = await setup({ storage: false });
    expect((await session(noStorage.app)).status).toBe(404);
    expect((await getControl(noStorage.app)).status).toBe(404);
    const noControl = await setup({ control: false });
    expect((await getControl(noControl.app)).status).toBe(404);
    expect((await changeControl(noControl.app)).status).toBe(404);
  });

  it('uses memory:write for session/change and memory:read for control reads', async () => {
    const permissions: string[] = [];
    const fga = {
      check: async () => true,
      require: async (_user: unknown, input: { permission: string }) => {
        permissions.push(input.permission);
        if (input.permission === 'memory:write') throw new Error('denied');
      },
      filterAccessible: async (_user: unknown, items: unknown[]) => items,
    };
    const { app, viewer, control } = await setup({ fga });
    expect((await getControl(app)).status).toBe(200);
    expect((await session(app)).status).toBe(404);
    expect((await changeControl(app)).status).toBe(404);
    expect(permissions).toEqual(['memory:read', 'memory:write', 'memory:write']);
    expect(viewer).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
  });

  it('rejects malformed, disallowed, and non-http origins before route side effects', async () => {
    const { app, viewer, controlState, control } = await setup({ allowedOrigins: ['http://studio.test'] });
    for (const origin of ['http://evil.test', 'not a url', 'file://x']) {
      expect((await session(app, {}, { origin })).status).toBe(404);
      expect((await getControl(app, undefined, { ...authorized, origin })).status).toBe(404);
      expect((await changeControl(app, {}, { origin })).status).toBe(404);
    }
    expect(viewer).not.toHaveBeenCalled();
    expect(controlState).not.toHaveBeenCalled();
    expect(control).not.toHaveBeenCalled();
    const downgraded = await app.request('https://localhost/api/computers/c1/session', {
      method: 'POST',
      headers: { ...authorized, 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'control' }),
    });
    expect(downgraded.status).toBe(404);
    expect(viewer).not.toHaveBeenCalled();
    expect((await session(app, {}, { origin: 'http://studio.test' })).status).toBe(200);
    expect(viewer).toHaveBeenCalledTimes(1);
  });

  it('uses the shared public-origin precedence for proxy-facing computer routes', async () => {
    const { app, viewer } = await setup();
    const response = await app.request('http://internal.test/api/computers/c1/session', {
      method: 'POST',
      headers: {
        ...authorized,
        'content-type': 'application/json',
        'x-mastra-public-host': 'studio.test',
        'x-forwarded-host': 'internal-proxy.test',
        origin: 'https://studio.test',
      },
      body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'control' }),
    });

    expect(response.status).toBe(200);
    expect(viewer).toHaveBeenCalledOnce();
  });

  it('accepts JSON parameters, allows no-Origin clients, and validates notes', async () => {
    const { app, control } = await setup();
    expect((await changeControl(app, {}, { 'content-type': 'application/json; charset=utf-8' })).status).toBe(200);
    const noOrigin = await app.request('http://localhost/api/computers/c1/control', {
      method: 'POST',
      headers: { ...authorized, 'content-type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', action: 'release' }),
    });
    expect(noOrigin.status).toBe(200);
    expect(
      (
        await app.request('http://localhost/api/computers/c1/control?threadId=thread-1&resourceId=res-1', {
          headers: authorized,
        })
      ).status,
    ).toBe(200);
    expect((await changeControl(app, { note: 'x'.repeat(501) })).status).toBe(400);
    expect((await changeControl(app, { action: 'release', note: '' })).status).toBe(200);
    expect(control.mock.calls.at(-1)?.[2]).toEqual({ action: 'release' });
  });

  it('reads and changes control while rechecking attachment every request', async () => {
    const { app, state, control } = await setup();
    await expect((await getControl(app)).json()).resolves.toEqual({ holder: 'agent', revision: 0 });
    await expect((await changeControl(app, { note: 'login' })).json()).resolves.toMatchObject({
      holder: 'human',
      revision: 1,
    });
    expect(control).toHaveBeenLastCalledWith(
      'c1',
      { threadId: 'thread-1', resourceId: 'res-1' },
      { action: 'take', note: 'login' },
    );
    state.attached = false;
    expect((await getControl(app)).status).toBe(404);
    expect((await changeControl(app, { action: 'release' })).status).toBe(404);
  });
});
