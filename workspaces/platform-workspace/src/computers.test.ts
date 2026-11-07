import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { DESKTOP_PACKAGES } from './computer.js';
import type { ComputerSandbox } from './computers.js';
import {
  DESTROY_FAILED,
  HUMAN_HAS_CONTROL,
  MISSING_IDENTITY,
  NOT_ATTACHED,
  NOT_FOUND,
  PlatformComputers,
  UNAVAILABLE,
} from './computers.js';
import type { PlatformSandboxOptions } from './sandbox.js';
import { Template, serializeSandboxTemplate } from './template.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface Gate {
  entered: Promise<void>;
  enter(): void;
  opened: Promise<void>;
  open(): void;
}

function gate(): Gate {
  let enter!: () => void;
  let open!: () => void;
  const entered = new Promise<void>(r => (enter = r));
  const opened = new Promise<void>(r => (open = r));
  return { entered, enter, opened, open };
}

/** A shared fake platform: VMs outlive any one PlatformComputers instance, like the real proxy. */
class FakeBackend {
  vms = new Map<string, { alive: boolean }>();
  createCalls: { kind: 'provision' | 'reattach'; sandboxId?: string }[] = [];
  createOptions: PlatformSandboxOptions[] = [];
  actions: string[] = [];
  latency: Record<string, number> = {};
  gates: Record<string, Gate> = {};
  destroys = 0;
  startDelayMs = 0;
  nextSandboxId?: string;
  failStart?: Error;
  failDestroy = false;
  failScreenshot = false;
  checkpoint: any = { status: 'captured', checkpointName: 'ck-internal' };
  viewerUrl: string | null = 'https://6080-vm.preview.test/vnc.html?autoconnect=1';
  cookie: { name: string; value: string } | null = { name: '__mastra_preview', value: 'secret-cookie' };
  #n = 0;

  create = (options: PlatformSandboxOptions): ComputerSandbox => {
    const backend = this;
    backend.createOptions.push(options);
    let id: string | undefined;
    const act = async (name: string) => {
      await sleep(backend.latency[name] ?? 0);
      const gate = backend.gates[name];
      if (gate) {
        delete backend.gates[name];
        gate.enter();
        await gate.opened;
      }
      backend.actions.push(name);
    };
    return {
      get sandboxId() {
        return id;
      },
      async start() {
        await sleep(backend.startDelayMs);
        if (backend.failStart) {
          const e = backend.failStart;
          backend.failStart = undefined;
          throw e;
        }
        if (options.sandboxId) {
          backend.createCalls.push({ kind: 'reattach', sandboxId: options.sandboxId });
          if (!backend.vms.get(options.sandboxId)?.alive) {
            throw Object.assign(new Error('gone'), { code: 'SANDBOX_REATTACH_FAILED', reason: '410' });
          }
          id = options.sandboxId;
          return;
        }
        backend.createCalls.push({ kind: 'provision' });
        id = backend.nextSandboxId ?? `sbx-${++backend.#n}`;
        backend.vms.set(id, { alive: true });
      },
      async destroy() {
        backend.destroys++;
        if (backend.failDestroy) throw new Error('proxy 500 sbx internal');
        if (id) backend.vms.set(id, { alive: false });
      },
      async captureCheckpoint() {
        await act('snapshot');
        return backend.checkpoint;
      },
      async executeCommand(command: string) {
        await act(`exec:${command}`);
        return { exitCode: 0, stdout: 'out', stderr: '' };
      },
      async getPortAuthCookie() {
        return backend.cookie
          ? {
              ...backend.cookie,
              domain: 'x',
              path: '/',
              expires: 0,
              httpOnly: true,
              secure: true,
              sameSite: 'Lax' as const,
            }
          : null;
      },
      computer: {
        screenshot: async () => {
          if (backend.failScreenshot) throw new Error('scrot failed');
          await act('screenshot');
          return { data: PNG, mediaType: 'image/png' as const };
        },
        leftClick: async () => act('click'),
        rightClick: async () => act('rightClick'),
        doubleClick: async () => act('doubleClick'),
        moveMouse: async () => act('move'),
        drag: async () => act('drag'),
        scroll: async () => act('scroll'),
        type: async () => act('type'),
        press: async () => act('key'),
        getScreenSize: async () => ({ width: 1280, height: 800 }),
        getCursorPosition: async () => ({ x: 1, y: 2 }),
        streamUrl: async () => backend.viewerUrl,
      },
    };
  };
}

function ctx(resourceId: string | undefined, threadId: string | undefined, events: unknown[] = []) {
  return {
    agent: { resourceId, threadId, toolCallId: 'c', messages: [], suspend: async () => {} },
    writer: { custom: async (chunk: unknown) => void events.push(chunk) },
  } as any;
}

let backend: FakeBackend;
const make = (extra: Record<string, unknown> = {}) =>
  new PlatformComputers({ secret: 'test-secret', environmentId: 'env-1', createSandbox: backend.create, ...extra });

async function call(computers: PlatformComputers, tool: string, input: unknown, context: unknown): Promise<any> {
  return (computers.tools()[tool] as any).execute(input, context);
}

beforeEach(() => {
  process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
  backend = new FakeBackend();
});
afterEach(() => {
  delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  delete process.env.MASTRA_COMPUTERS_SECRET;
});

describe('PlatformComputers construction', () => {
  it('throws with the flag off', () => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
    expect(() => make()).toThrow('set MASTRA_EXPERIMENTAL_COMPUTER=true');
  });

  it('throws a distinct error with no secret or access token', () => {
    const saved = { a: process.env.MASTRA_PLATFORM_ACCESS_TOKEN, b: process.env.MASTRA_PLATFORM_SECRET_KEY };
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    try {
      expect(() => new PlatformComputers({ secret: '', accessToken: '' })).toThrow(
        'PlatformComputers needs a secret (set MASTRA_COMPUTERS_SECRET or an access token)',
      );
    } finally {
      if (saved.a !== undefined) process.env.MASTRA_PLATFORM_ACCESS_TOKEN = saved.a;
      if (saved.b !== undefined) process.env.MASTRA_PLATFORM_SECRET_KEY = saved.b;
    }
  });

  it('registers on Mastra and exposes exactly the contract tool ids', () => {
    const computers = make();
    expect(new Mastra({ logger: false, computers }).getComputers()).toBe(computers);
    expect(Object.keys(computers.tools()).sort()).toEqual(
      [
        'computer_list',
        'computer_create',
        'computer_attach',
        'computer_release',
        'computer_snapshot',
        'computer_destroy',
        'computer_screenshot',
        'computer_click',
        'computer_move',
        'computer_drag',
        'computer_scroll',
        'computer_type',
        'computer_key',
        'computer_screen_info',
        'computer_exec',
        'computer_request_human',
      ].sort(),
    );
    for (const [id, tool] of Object.entries(computers.tools())) expect(tool.id).toBe(id);
  });
});

describe('computer ids', () => {
  it('match fixed vectors for secret and HKDF keys', () => {
    const resource = 'user|"ü"';
    expect(make().mintId(true, 'sbx-abc', resource)).toBe('cmp_p_sbx-abc_MY7PkUexKgeEUt9Pdrzq4Q');
    const hkdf = new PlatformComputers({ accessToken: 'tok', environmentId: 'env-1', createSandbox: backend.create });
    expect(hkdf.mintId(false, 'sbx-abc', resource)).toBe('cmp_e_sbx-abc_PoIfILmz5F9o8YtUKHBc8A');
  });

  it('prefers options.secret over MASTRA_COMPUTERS_SECRET over the access token', () => {
    process.env.MASTRA_COMPUTERS_SECRET = 'test-secret';
    const fromEnv = new PlatformComputers({
      accessToken: 'tok',
      environmentId: 'env-1',
      createSandbox: backend.create,
    });
    expect(fromEnv.mintId(true, 's', 'r')).toBe(make().mintId(true, 's', 'r'));
    expect(make({ secret: 'other' }).mintId(true, 's', 'r')).not.toBe(make().mintId(true, 's', 'r'));
  });

  it.each([
    ['malformed', 'not-an-id'],
    ['bad mac', 'cmp_p_sbx-1_AAAAAAAAAAAAAAAAAAAAAA'],
    ['flag swapped', () => make().mintId(true, 'sbx-1', 'r1').replace('cmp_p_', 'cmp_e_')],
    ['other resource', () => make().mintId(true, 'sbx-1', 'r2')],
    ['other environment', () => make({ environmentId: 'env-2' }).mintId(true, 'sbx-1', 'r1')],
    ['shell metacharacters', 'cmp_p_$(rm -rf)_AAAAAAAAAAAAAAAAAAAAAA'],
  ])('%s → not found with zero backend calls', async (_label, id) => {
    backend.vms.set('sbx-1', { alive: true });
    const computers = make();
    const value = typeof id === 'function' ? id() : id;
    expect(await call(computers, 'computer_attach', { id: value }, ctx('r1', 't1'))).toBe(NOT_FOUND);
    expect(await call(computers, 'computer_destroy', { id: value }, ctx('r1', 't1'))).toBe(NOT_FOUND);
    expect(backend.createCalls).toEqual([]);
  });
});

describe('attachment', () => {
  it('refuses hands with no computer attached', async () => {
    const computers = make();
    for (const [tool, input] of [
      ['computer_click', { x: 1, y: 1 }],
      ['computer_screenshot', {}],
      ['computer_exec', { command: 'ls' }],
      ['computer_snapshot', {}],
    ] as const) {
      expect(await call(computers, tool, input, ctx('r1', 't1'))).toBe(NOT_ATTACHED);
    }
    expect(backend.actions).toEqual([]);
  });

  it('refuses without a thread or resource id', async () => {
    const computers = make();
    expect(await call(computers, 'computer_create', {}, ctx(undefined, 't1'))).toBe(MISSING_IDENTITY);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', undefined))).toBe(MISSING_IDENTITY);
    expect(backend.createCalls).toEqual([]);
  });

  it('keys attachment by resource and thread', async () => {
    const computers = make();
    const events: any[] = [];
    const { computer } = await call(computers, 'computer_create', { name: 'box' }, ctx('r1', 't1', events));
    expect(computer).toEqual({
      id: computer.id,
      name: 'box',
      template: 'desktop',
      status: 'attached',
      persistent: false,
    });
    expect(events).toEqual([
      {
        type: 'data-computer',
        data: { computerId: computer.id, threadId: 't1', name: 'box', status: 'attached', persistent: false },
      },
    ]);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'))).toBe('clicked at (1, 1)');
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't2'))).toBe(NOT_ATTACHED);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r2', 't1'))).toBe(NOT_ATTACHED);
  });

  it('falls back to request context ids, preferring context.agent', async () => {
    const computers = make();
    const rc = new RequestContext();
    rc.set(MASTRA_RESOURCE_ID_KEY, 'r-rc');
    rc.set(MASTRA_THREAD_ID_KEY, 't-rc');
    await call(computers, 'computer_create', {}, { requestContext: rc });
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r-rc', 't-rc'))).toBe('clicked at (1, 1)');
    expect(
      await call(computers, 'computer_click', { x: 1, y: 1 }, { ...ctx('r-agent', 't-agent'), requestContext: rc }),
    ).toBe(NOT_ATTACHED);
  });

  it('replaces the thread attachment; the old computer stays listable and reattachable', async () => {
    const computers = make();
    const a = (await call(computers, 'computer_create', { name: 'a' }, ctx('r1', 't1'))).computer;
    const b = (await call(computers, 'computer_create', { name: 'b' }, ctx('r1', 't1'))).computer;
    expect(
      (await call(computers, 'computer_list', {}, ctx('r1', 't1'))).computers.map((c: any) => [c.name, c.status]),
    ).toEqual([
      ['a', 'available'],
      ['b', 'attached'],
    ]);
    expect((await call(computers, 'computer_list', {}, ctx('r2', 't1'))).computers).toEqual([]);
    const released = await call(computers, 'computer_release', {}, ctx('r1', 't1'));
    expect(released.computer.id).toBe(b.id);
    expect((await call(computers, 'computer_attach', { id: a.id }, ctx('r1', 't1'))).computer.id).toBe(a.id);
  });

  it('does not let ids containing ":" collide across resources', async () => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('u1:x', 't'));
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('u1', 'x:t'))).toBe(NOT_ATTACHED);
    expect(await call(computers, 'computer_list', {}, ctx('u1', 'x:t'))).toEqual({ computers: [] });
  });

  it('rejects a non-canonical alias of a valid id', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', { persist: true }, ctx('r1', 't1'));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(computer.id.at(-1));
    const alias = computer.id.slice(0, -1) + alphabet[last ^ 1];
    expect(Buffer.from(alias.slice(-22), 'base64url')).toEqual(Buffer.from(computer.id.slice(-22), 'base64url'));
    backend.createCalls = [];
    expect(await call(make(), 'computer_attach', { id: alias }, ctx('r1', 't1'))).toBe(NOT_FOUND);
    expect(await call(computers, 'computer_attach', { id: alias }, ctx('r1', 't1'))).toBe(NOT_FOUND);
    expect(backend.createCalls).toEqual([]);
  });

  it('serializes lifecycle calls per thread in call order', async () => {
    const computers = make();
    backend.startDelayMs = 10;
    const a = call(computers, 'computer_create', { name: 'a' }, ctx('r1', 't1'));
    const b = call(computers, 'computer_create', { name: 'b' }, ctx('r1', 't1'));
    const released = call(computers, 'computer_release', {}, ctx('r1', 't1'));
    const [ra, rb] = await Promise.all([a, b]);
    expect([ra.computer.name, rb.computer.name]).toEqual(['a', 'b']);
    expect((await released).computer.name).toBe('b');
    const att = call(computers, 'computer_attach', { id: ra.computer.id }, ctx('r1', 't1'));
    const rel = call(computers, 'computer_release', {}, ctx('r1', 't1'));
    expect((await att).computer.id).toBe(ra.computer.id);
    expect((await rel).computer.id).toBe(ra.computer.id);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'))).toBe(NOT_ATTACHED);
  });

  it('completes lifecycle changes when the stream writer fails', async () => {
    const computers = make();
    const broken = { ...ctx('r1', 't1'), writer: { custom: async () => Promise.reject(new Error('closed')) } };
    const { computer } = await call(computers, 'computer_create', {}, broken);
    expect((await call(computers, 'computer_release', {}, broken)).computer.status).toBe('released');
    expect((await call(computers, 'computer_attach', { id: computer.id }, broken)).computer.status).toBe('attached');
    expect(await call(computers, 'computer_destroy', { id: computer.id }, broken)).toEqual({ destroyed: computer.id });
  });

  it('refuses another resource attaching or destroying a computer, without side effects', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', { persist: true }, ctx('r1', 't1'));
    const events: unknown[] = [];
    backend.createCalls = [];
    expect(await call(computers, 'computer_attach', { id: computer.id }, ctx('r2', 't9', events))).toBe(NOT_FOUND);
    expect(await call(computers, 'computer_destroy', { id: computer.id }, ctx('r2', 't9', events))).toBe(NOT_FOUND);
    expect(events).toEqual([]);
    expect(backend.createCalls).toEqual([]);
    expect([...backend.vms.values()].every(v => v.alive)).toBe(true);
  });
});

describe('lifecycle', () => {
  it('maps create failures to a stable message and destroys the partial sandbox', async () => {
    backend.nextSandboxId = 'bad id!';
    expect(await call(make(), 'computer_create', {}, ctx('r1', 't1'))).toBe(UNAVAILABLE);
    expect(backend.vms.get('bad id!')?.alive).toBe(false);
  });

  it('destroys: queued hands finish, later hands are refused, then unattached', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.latency.type = 20;
    const typed = call(computers, 'computer_type', { text: 'x' }, ctx('r1', 't1'));
    const destroyed = call(computers, 'computer_destroy', { id: computer.id }, ctx('r1', 't1'));
    const keyed = call(computers, 'computer_key', { keys: 'a' }, ctx('r1', 't1'));
    await sleep(0);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'))).toBe(NOT_ATTACHED);
    expect(await typed).toBe('typed');
    expect(await keyed).toBe('pressed');
    expect(await destroyed).toEqual({ destroyed: computer.id });
    expect(backend.actions).toEqual(['type', 'key']);
    expect(await call(computers, 'computer_attach', { id: computer.id }, ctx('r1', 't1'))).toBe(NOT_FOUND);
  });

  it('reports destroy failure without leaking internals', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.failDestroy = true;
    expect(await call(computers, 'computer_destroy', { id: computer.id }, ctx('r1', 't1'))).toBe(DESTROY_FAILED);
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'))).toBe(NOT_ATTACHED);
  });

  it('runs hands tools against the driver', async () => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    const c = ctx('r1', 't1');
    const shot = await call(computers, 'computer_screenshot', {}, c);
    expect(shot).toMatchObject({ mediaType: 'image/png', data: Buffer.from(PNG).toString('base64') });
    expect((computers.tools().computer_screenshot as any).toModelOutput(shot).value[1].type).toBe('media');
    await call(computers, 'computer_click', { x: 1, y: 2, button: 'right' }, c);
    await call(computers, 'computer_click', { x: 1, y: 2, double: true }, c);
    await call(computers, 'computer_move', { x: 3, y: 4 }, c);
    await call(computers, 'computer_drag', { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }, c);
    await call(computers, 'computer_scroll', { direction: 'down', amount: 2 }, c);
    expect(await call(computers, 'computer_screen_info', {}, c)).toEqual({
      screen: { width: 1280, height: 800 },
      cursor: { x: 1, y: 2 },
    });
    expect(await call(computers, 'computer_exec', { command: 'echo hi' }, c)).toEqual({
      exitCode: 0,
      stdout: 'out',
      stderr: '',
    });
    expect(await call(computers, 'computer_snapshot', {}, c)).toEqual({ status: 'captured' });
    backend.checkpoint = { status: 'skipped', reason: 'sandbox-not-running' };
    expect(await call(computers, 'computer_snapshot', {}, c)).toEqual({
      status: 'skipped',
      reason: 'sandbox-not-running',
    });
    expect(backend.actions).toEqual([
      'screenshot',
      'rightClick',
      'doubleClick',
      'move',
      'drag',
      'scroll',
      'exec:echo hi',
      'snapshot',
      'snapshot',
    ]);
  });

  it('rejects out-of-range exec timeouts by schema', () => {
    const schema = (make().tools().computer_exec as any).inputSchema;
    expect(schema.safeParse({ command: 'ls', timeout: 600_001 }).success).toBe(false);
    expect(schema.safeParse({ command: 'ls', timeout: 1000 }).success).toBe(true);
  });
});

describe('persistence across processes', () => {
  it('reattaches a persistent id in a fresh process, with name reset', async () => {
    const id = (await call(make(), 'computer_create', { name: 'box', persist: true }, ctx('r1', 't1'))).computer.id;
    const fresh = make();
    const events: any[] = [];
    const result = await call(fresh, 'computer_attach', { id }, ctx('r1', 't2', events));
    expect(result.computer).toEqual({
      id,
      name: 'computer',
      template: 'desktop',
      status: 'attached',
      persistent: true,
    });
    expect(backend.createCalls.at(-1)).toEqual({ kind: 'reattach', sandboxId: id.split('_')[2] });
    expect(events[0].data.status).toBe('attached');
    expect(await call(fresh, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't2'))).toBe('clicked at (1, 1)');
  });

  it('does not reattach an ephemeral id in a fresh process', async () => {
    const id = (await call(make(), 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    backend.createCalls = [];
    expect(await call(make(), 'computer_attach', { id }, ctx('r1', 't1'))).toBe(NOT_FOUND);
    expect(backend.createCalls).toEqual([]);
  });

  it('reattaches a released ephemeral computer in the same process', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    await call(computers, 'computer_release', {}, ctx('r1', 't1'));
    expect((await call(computers, 'computer_attach', { id }, ctx('r1', 't1'))).computer.id).toBe(id);
  });

  it('destroys a persistent id from a fresh process, then reports not found', async () => {
    const id = (await call(make(), 'computer_create', { persist: true }, ctx('r1', 't1'))).computer.id;
    expect(await call(make(), 'computer_destroy', { id }, ctx('r1', 't1'))).toEqual({ destroyed: id });
    expect([...backend.vms.values()].every(v => !v.alive)).toBe(true);
    const out = await call(make(), 'computer_attach', { id }, ctx('r1', 't1'));
    expect(out).toBe(NOT_FOUND);
  });

  it('shares one reconstruct between two threads attaching the same id', async () => {
    const id = (await call(make(), 'computer_create', { persist: true }, ctx('r1', 't1'))).computer.id;
    backend.createCalls = [];
    backend.startDelayMs = 10;
    const fresh = make();
    const [a, b] = await Promise.all([
      call(fresh, 'computer_attach', { id }, ctx('r1', 'tA')),
      call(fresh, 'computer_attach', { id }, ctx('r1', 'tB')),
    ]);
    expect([a.computer.id, b.computer.id]).toEqual([id, id]);
    expect(backend.createCalls).toEqual([{ kind: 'reattach', sandboxId: id.split('_')[2] }]);
  });

  it('lets a destroy racing an attach win', async () => {
    const id = (await call(make(), 'computer_create', { persist: true }, ctx('r1', 't1'))).computer.id;
    backend.startDelayMs = 10;
    const fresh = make();
    const attached = call(fresh, 'computer_attach', { id }, ctx('r1', 'tA'));
    const destroyed = call(fresh, 'computer_destroy', { id }, ctx('r1', 'tB'));
    expect(await destroyed).toEqual({ destroyed: id });
    expect(await attached).toBe(NOT_FOUND);
    expect(await call(fresh, 'computer_click', { x: 1, y: 1 }, ctx('r1', 'tA'))).toBe(NOT_ATTACHED);
  });

  it('retries after a transient reattach failure without leaking details', async () => {
    const id = (await call(make(), 'computer_create', { persist: true }, ctx('r1', 't1'))).computer.id;
    backend.createCalls = [];
    const fresh = make();
    backend.failStart = new Error('proxy 503 sbx-1 body');
    expect(await call(fresh, 'computer_attach', { id }, ctx('r1', 't1'))).toBe(UNAVAILABLE);
    expect((await call(fresh, 'computer_attach', { id }, ctx('r1', 't1'))).computer.id).toBe(id);
    expect(backend.createCalls).toHaveLength(1);
  });
});

describe('viewer', () => {
  it('returns url and cookie header for the attached thread only', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    const viewer = await computers.viewer(computer.id, { resourceId: 'r1', threadId: 't1' });
    expect(viewer).toEqual({
      url: 'https://6080-vm.preview.test/vnc.html?autoconnect=1',
      headers: { cookie: '__mastra_preview=secret-cookie' },
    });
    expect(viewer!.url).not.toMatch(/token|grant|secret/);
    await expect(computers.viewer(computer.id, { resourceId: 'r2', threadId: 't1' })).rejects.toThrow(
      'computer not attached',
    );
    await expect(computers.viewer('cmp_nope', { resourceId: 'r1', threadId: 't1' })).rejects.toThrow(
      'computer not attached',
    );
  });

  it('returns null when the viewer url or cookie is unavailable', async () => {
    const computers = make();
    const { computer } = await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.cookie = null;
    expect(await computers.viewer(computer.id, { resourceId: 'r1', threadId: 't1' })).toBeNull();
    backend.cookie = { name: 'a', value: 'b' };
    backend.viewerUrl = null;
    expect(await computers.viewer(computer.id, { resourceId: 'r1', threadId: 't1' })).toBeNull();
  });
});

function parallelToolCallModel(calls: { toolName: string; input: unknown }[]) {
  let step = 0;
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  return {
    specificationVersion: 'v2' as const,
    provider: 'test',
    modelId: 'parallel-tool-calls',
    supportedUrls: {},
    doGenerate: async () =>
      step++ === 0
        ? {
            content: calls.map((c, i) => ({
              type: 'tool-call' as const,
              toolCallId: `call_${i}`,
              toolName: c.toolName,
              input: JSON.stringify(c.input),
            })),
            finishReason: 'tool-calls' as const,
            usage,
            warnings: [],
          }
        : { content: [{ type: 'text' as const, text: 'done' }], finishReason: 'stop' as const, usage, warnings: [] },
    doStream: async () => {
      throw new Error('not used');
    },
  };
}

function streamingToolCallModel(calls: { toolName: string; input: unknown }[]) {
  let step = 0;
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  const stream = (parts: unknown[]) =>
    new ReadableStream({
      start(controller) {
        for (const p of parts) controller.enqueue(p);
        controller.close();
      },
    });
  return {
    specificationVersion: 'v2' as const,
    provider: 'test',
    modelId: 'streaming-tool-calls',
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error('not used');
    },
    doStream: async () => ({
      stream:
        step++ === 0
          ? stream([
              ...calls.map((c, i) => ({
                type: 'tool-call',
                toolCallId: `call_${i}`,
                toolName: c.toolName,
                input: JSON.stringify(c.input),
              })),
              { type: 'finish', finishReason: 'tool-calls', usage },
            ])
          : stream([
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ]),
    }),
  };
}

describe('ordering through a real agent at default tool concurrency', () => {
  const steps = [
    { toolName: 'computer_click', input: { x: 1, y: 2 } },
    { toolName: 'computer_type', input: { text: 'echo hi' } },
    { toolName: 'computer_key', input: { keys: 'Enter' } },
  ];

  async function run(tools: Record<string, any>) {
    const agent = new Agent({
      id: 'computer-order',
      name: 'computer-order',
      instructions: 'Use the computer.',
      model: parallelToolCallModel(steps) as any,
      tools,
    });
    const rc = new RequestContext();
    rc.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    rc.set(MASTRA_THREAD_ID_KEY, 't1');
    await agent.generate('go', { maxSteps: 3, requestContext: rc });
  }

  it('reaches the desktop in model order even when earlier actions are slower', async () => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.latency = { click: 30, type: 10, key: 0 };
    await run(computers.tools());
    expect(backend.actions).toEqual(['click', 'type', 'key']);
  });

  it('delivers data-computer chunks through the agent stream', async () => {
    const computers = make();
    const agent = new Agent({
      id: 'computer-events',
      name: 'computer-events',
      instructions: 'Use the computer.',
      model: streamingToolCallModel([{ toolName: 'computer_create', input: { name: 'box' } }]) as any,
      tools: computers.tools(),
    });
    const rc = new RequestContext();
    rc.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    rc.set(MASTRA_THREAD_ID_KEY, 't1');
    const stream = await agent.stream('go', { maxSteps: 3, requestContext: rc });
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream as any) if (chunk.type === 'data-computer') chunks.push(chunk);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].data).toMatchObject({ threadId: 't1', name: 'box', status: 'attached', persistent: false });
    expect(JSON.stringify(chunks)).not.toMatch(/secret-cookie|__mastra_preview|https?:/);
  });

  it('red: a tool that awaits before taking its slot misorders in the same harness', async () => {
    const latency: Record<string, number> = { click: 30, type: 10, key: 0 };
    const seen: string[] = [];
    const naive = (name: string) =>
      createTool({
        id: `computer_${name}`,
        description: name,
        inputSchema: z.object({}).passthrough(),
        execute: async () => {
          await sleep(latency[name]!);
          seen.push(name);
          return 'ok';
        },
      });
    await run({ computer_click: naive('click'), computer_type: naive('type'), computer_key: naive('key') });
    expect(seen).toEqual(['key', 'type', 'click']);
  });
});

describe('control lease', () => {
  const scope = { resourceId: 'r1', threadId: 't1' };

  async function handedOver() {
    const computers = make();
    const events: any[] = [];
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const out = await call(computers, 'computer_request_human', { reason: 'log in please' }, ctx('r1', 't1', events));
    return { computers, id, out, events };
  }

  it('computer_request_human hands control to the user with a status-free part', async () => {
    const { computers, id, out, events } = await handedOver();
    expect(out).toEqual({
      computerId: id,
      reason: 'log in please',
      control: 'human',
      message: 'Stop using the computer and end your turn. You will be notified when the user hands it back.',
    });
    expect(events).toEqual([
      { type: 'data-computer', data: { computerId: id, threadId: 't1', control: 'human', reason: 'log in please' } },
    ]);
    expect(events[0].data).not.toHaveProperty('status');
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'human', reason: 'log in please' });
  });

  it('writes the control part before returning, and a failing writer keeps the handoff', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const written = gate();
    const slow = { ...ctx('r1', 't1'), writer: { custom: () => written.opened.then(() => written.enter()) } };
    let returned = false;
    const out = call(computers, 'computer_request_human', { reason: 'slow' }, slow).then(r => ((returned = true), r));
    await sleep(5);
    expect(returned).toBe(false);
    written.open();
    await out;
    await written.entered;
    const failing = {
      ...ctx('r1', 't2'),
      writer: {
        custom: async () => {
          throw new Error('closed');
        },
      },
    };
    const other = (await call(computers, 'computer_create', {}, ctx('r1', 't2'))).computer.id;
    await expect(call(computers, 'computer_request_human', { reason: 'x' }, failing)).resolves.toMatchObject({
      control: 'human',
    });
    await expect(computers.controlState(other, { resourceId: 'r1', threadId: 't2' })).resolves.toMatchObject({
      holder: 'human',
    });
    expect(id).not.toBe(other);
  });

  it('is idempotent and keeps the first reason', async () => {
    const { computers, id } = await handedOver();
    const again = await call(computers, 'computer_request_human', { reason: 'other' }, ctx('r1', 't1'));
    expect(again.reason).toBe('log in please');
    await expect(computers.controlState(id, scope)).resolves.toMatchObject({ reason: 'log in please' });
  });

  it('refuses every hand and lifecycle tool with the exact text without touching the driver', async () => {
    const { computers, id } = await handedOver();
    backend.actions = [];
    const calls: [string, unknown][] = [
      ['computer_screenshot', {}],
      ['computer_click', { x: 1, y: 1 }],
      ['computer_move', { x: 1, y: 1 }],
      ['computer_drag', { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }],
      ['computer_scroll', { direction: 'down', amount: 1 }],
      ['computer_type', { text: 'x' }],
      ['computer_key', { keys: 'Enter' }],
      ['computer_screen_info', {}],
      ['computer_exec', { command: 'id' }],
      ['computer_snapshot', {}],
      ['computer_release', {}],
      ['computer_destroy', { id }],
    ];
    for (const [tool, input] of calls) {
      expect(await call(computers, tool, input, ctx('r1', 't1')), tool).toBe(HUMAN_HAS_CONTROL);
    }
    expect(backend.actions).toEqual([]);
    expect(backend.destroys).toBe(0);
    await expect(computers.viewer(id, scope)).resolves.not.toBeNull();
  });

  it('refuses request_human without an attached computer', async () => {
    const computers = make();
    expect(await call(computers, 'computer_request_human', { reason: 'x' }, ctx('r1', 't1'))).toBe(NOT_ATTACHED);
    expect(await call(computers, 'computer_request_human', { reason: 'x' }, ctx(undefined, 't1'))).toBe(
      MISSING_IDENTITY,
    );
  });

  it('hand back restores the hands; repeated actions are no-ops', async () => {
    const { computers, id } = await handedOver();
    await expect(computers.control(id, scope, { action: 'take' })).resolves.toEqual({
      holder: 'human',
      notified: false,
      reason: 'no-change',
    });
    await expect(computers.control(id, scope, { action: 'release', note: 'done' })).resolves.toMatchObject({
      holder: 'agent',
    });
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'agent' });
    await expect(computers.control(id, scope, { action: 'release' })).resolves.toMatchObject({ reason: 'no-change' });
    expect(await call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'))).toBe('clicked at (1, 1)');
  });

  it('user take works at any time and records a reason', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    await expect(computers.control(id, scope, { action: 'take' })).resolves.toMatchObject({ holder: 'human' });
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'human', reason: 'user took control' });
    expect(await call(computers, 'computer_type', { text: 'x' }, ctx('r1', 't1'))).toBe(HUMAN_HAS_CONTROL);
  });

  it('control and controlState throw for another thread or resource, and on long notes', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    for (const other of [
      { resourceId: 'r1', threadId: 't2' },
      { resourceId: 'r2', threadId: 't1' },
    ]) {
      await expect(computers.controlState(id, other)).rejects.toThrow('computer not attached');
      await expect(computers.control(id, other, { action: 'take' })).rejects.toThrow('computer not attached');
    }
    await expect(computers.control(id, scope, { action: 'take', note: 'x'.repeat(501) })).rejects.toThrow(
      'note too long',
    );
    await expect(computers.controlState(id, scope)).resolves.toEqual({ holder: 'agent' });
  });

  it('a take while an action is in flight lets it finish and refuses the queued ones', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const g = (backend.gates.click = gate());
    const click = call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'));
    const type = call(computers, 'computer_type', { text: 'x' }, ctx('r1', 't1'));
    await g.entered;
    await computers.control(id, scope, { action: 'take' });
    g.open();
    expect(await click).toBe('clicked at (1, 1)');
    expect(await type).toBe(HUMAN_HAS_CONTROL);
    expect(backend.actions).toEqual(['click']);
  });

  it('request_human refuses a queued screenshot but lets an in-flight one finish', async () => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    const g = (backend.gates.click = gate());
    const click = call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'));
    const queued = call(computers, 'computer_screenshot', {}, ctx('r1', 't1'));
    await g.entered;
    await call(computers, 'computer_request_human', { reason: 'r' }, ctx('r1', 't1'));
    g.open();
    await click;
    expect(await queued).toBe(HUMAN_HAS_CONTROL);
    expect(backend.actions).toEqual(['click']);

    const computers2 = make();
    await call(computers2, 'computer_create', {}, ctx('r1', 't9'));
    backend.actions = [];
    const g2 = (backend.gates.screenshot = gate());
    const inflight = call(computers2, 'computer_screenshot', {}, ctx('r1', 't9'));
    await g2.entered;
    await call(computers2, 'computer_request_human', { reason: 'r' }, ctx('r1', 't9'));
    g2.open();
    expect((await inflight).text).toMatch(/^Screenshot/);
    expect(backend.actions).toEqual(['screenshot']);
  });

  it('a destroy queued before a take refuses when it runs', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const other = (await call(computers, 'computer_create', {}, ctx('r1', 't2'))).computer.id;
    backend.startDelayMs = 20;
    const slow = call(computers, 'computer_attach', { id: other }, ctx('r1', 't1'));
    const destroy = call(computers, 'computer_destroy', { id }, ctx('r1', 't1'));
    await computers.control(id, scope, { action: 'take' });
    await slow;
    expect(await destroy).toBe(HUMAN_HAS_CONTROL);
    expect(backend.destroys).toBe(0);
  });

  it('a release queued before a take refuses when it runs', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const reattach = call(computers, 'computer_attach', { id }, ctx('r1', 't1'));
    const release = call(computers, 'computer_release', {}, ctx('r1', 't1'));
    await computers.control(id, scope, { action: 'take' });
    await reattach;
    expect(await release).toBe(HUMAN_HAS_CONTROL);
    await expect(computers.controlState(id, scope)).resolves.toMatchObject({ holder: 'human' });
  });

  it('a take during one model step lets the click finish and refuses type and key (real agent)', async () => {
    const computers = make();
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const agent = new Agent({
      id: 'computer-take',
      name: 'computer-take',
      instructions: 'Use the computer.',
      model: parallelToolCallModel([
        { toolName: 'computer_click', input: { x: 1, y: 2 } },
        { toolName: 'computer_type', input: { text: 'echo hi' } },
        { toolName: 'computer_key', input: { keys: 'Enter' } },
      ]) as any,
      tools: computers.tools(),
    });
    const rc = new RequestContext();
    rc.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    rc.set(MASTRA_THREAD_ID_KEY, 't1');
    const g = (backend.gates.click = gate());
    const run = agent.generate('go', { maxSteps: 3, requestContext: rc });
    await g.entered;
    await computers.control(id, scope, { action: 'take' });
    g.open();
    const result = await run;
    expect(backend.actions).toEqual(['click']);
    const outputs = Object.fromEntries(
      result.toolResults.map((r: any) => [r.payload?.toolName ?? r.toolName, r.payload?.result ?? r.result]),
    );
    expect(outputs).toEqual({
      computer_click: 'clicked at (1, 2)',
      computer_type: HUMAN_HAS_CONTROL,
      computer_key: HUMAN_HAS_CONTROL,
    });
  });
});

describe('screenshot after action', () => {
  const HANDS: [string, unknown, string][] = [
    ['computer_click', { x: 1, y: 2 }, 'click'],
    ['computer_move', { x: 3, y: 4 }, 'move'],
    ['computer_drag', { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }, 'drag'],
    ['computer_scroll', { direction: 'down', amount: 2 }, 'scroll'],
    ['computer_type', { text: 'hi' }, 'type'],
    ['computer_key', { keys: 'Enter' }, 'key'],
  ];

  it.each(HANDS)('%s returns text only by default', async (tool, input, action) => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    const result = await call(computers, tool, input, ctx('r1', 't1'));
    expect(typeof result).toBe('string');
    expect((computers.tools()[tool] as any).toModelOutput(result)).toBeUndefined();
    expect(backend.actions).toEqual([action]);
  });

  it.each(HANDS)('%s attaches one screenshot when enabled', async (tool, input, action) => {
    const computers = make({ screenshotAfterAction: true });
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    const result = await call(computers, tool, input, ctx('r1', 't1'));
    expect(backend.actions).toEqual([action, 'screenshot']);
    const out = (computers.tools()[tool] as any).toModelOutput(result);
    expect(out.value.map((p: { type: string }) => p.type)).toEqual(['text', 'media']);
    expect(out.value[1]).toMatchObject({ mediaType: 'image/png', data: Buffer.from(PNG).toString('base64') });
  });

  it.each([false, true])('computer_screenshot takes exactly one screenshot (screenshotAfterAction: %s)', async on => {
    const computers = make({ screenshotAfterAction: on });
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    await call(computers, 'computer_screenshot', {}, ctx('r1', 't1'));
    expect(backend.actions).toEqual(['screenshot']);
  });

  it('keeps model order with the screenshot inside each action slot', async () => {
    const computers = make({ screenshotAfterAction: true });
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.latency.click = 20;
    await Promise.all([
      call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1')),
      call(computers, 'computer_type', { text: 'x' }, ctx('r1', 't1')),
    ]);
    expect(backend.actions).toEqual(['click', 'screenshot', 'type', 'screenshot']);
  });

  it('reports the completed action when the follow-up screenshot fails', async () => {
    const computers = make({ screenshotAfterAction: true });
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    backend.failScreenshot = true;
    expect(await call(computers, 'computer_type', { text: 'x' }, ctx('r1', 't1'))).toBe('typed (screenshot failed)');
    expect(backend.actions).toEqual(['type']);
  });

  it('skips the screenshot when the user takes control during the action', async () => {
    const computers = make({ screenshotAfterAction: true });
    const id = (await call(computers, 'computer_create', {}, ctx('r1', 't1'))).computer.id;
    const g = (backend.gates.click = gate());
    const click = call(computers, 'computer_click', { x: 1, y: 1 }, ctx('r1', 't1'));
    await g.entered;
    await computers.control(id, { resourceId: 'r1', threadId: 't1' }, { action: 'take' });
    g.open();
    expect(await click).toBe('clicked at (1, 1)');
    expect(backend.actions).toEqual(['click']);
  });
});

describe('desktop template', () => {
  async function resolved(options: PlatformSandboxOptions) {
    const t = typeof options.template === 'function' ? await options.template() : options.template;
    return t && serializeSandboxTemplate(t);
  }

  it('boots new computers from withDesktop(Template()) by default, resources unchanged', async () => {
    const computers = make();
    await call(computers, 'computer_create', {}, ctx('r1', 't1'));
    expect(await resolved(backend.createOptions[0]!)).toEqual({
      schemaVersion: 1,
      operations: [{ method: 'aptInstall', args: [[...DESKTOP_PACKAGES]] }],
    });
    expect(backend.createOptions[0]).toMatchObject({ computer: true, environmentId: 'env-1' });
  });

  it('honors a custom template and omits it entirely with false', async () => {
    const custom = Template().aptInstall(['jq']);
    await call(make({ template: custom }), 'computer_create', {}, ctx('r1', 't1'));
    expect(backend.createOptions[0]!.template).toBe(custom);
    await call(make({ template: false }), 'computer_create', {}, ctx('r1', 't2'));
    expect('template' in backend.createOptions[1]!).toBe(false);
  });

  it('reattaches a persistent id with reattach required, never provisioning', async () => {
    const created = await call(make(), 'computer_create', { persist: true }, ctx('r1', 't1'));
    backend.createCalls = [];
    expect(await call(make(), 'computer_attach', { id: created.computer.id }, ctx('r1', 't1'))).toMatchObject({
      computer: { id: created.computer.id, status: 'attached' },
    });
    expect(backend.createCalls).toEqual([{ kind: 'reattach', sandboxId: created.computer.id.split('_')[2] }]);
    expect(backend.createOptions.at(-1)).toMatchObject({ reattach: 'required' });
  });
});
