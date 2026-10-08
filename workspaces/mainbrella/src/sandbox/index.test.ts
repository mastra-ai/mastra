import { describe, expect, it } from 'vitest';

import { API_KEY, CREATED_AT, FakeAPI } from '../../test/fake-api';
import { mainbrellaSandboxProvider } from '../provider';
import { MainbrellaSandbox } from './index';

function setup(options: ConstructorParameters<typeof MainbrellaSandbox>[0] = {}) {
  const api = new FakeAPI();
  const sandbox = new MainbrellaSandbox({
    apiKey: API_KEY,
    apiUrl: 'http://localhost:8787',
    fetch: api.fetch,
    ...options,
  });
  return { api, sandbox };
}

describe('MainbrellaSandbox', () => {
  it('creates one generation for concurrent starts and returns the acquisition outcome', async () => {
    const { api, sandbox } = setup({ creationKey: 'persisted-key' });
    const results = await Promise.all([sandbox.start(), sandbox.start(), sandbox.start()]);
    expect(results).toEqual([{ outcome: 'created' }, { outcome: 'created' }, { outcome: 'created' }]);
    expect(api.requests.filter(r => r.method === 'POST' && r.url.pathname === '/containers')).toHaveLength(1);
    expect(api.requests.find(r => r.method === 'POST')?.headers.get('Idempotency-Key')).toBe('persisted-key');
    expect(sandbox.container).toEqual({ id: 'c1', createdAt: CREATED_AT });
    expect(sandbox.status).toBe('running');
    expect(await sandbox.start()).toEqual({ outcome: 'connected' });
  });

  it('reconnects using both identity fields and never provisions a replacement for a missing generation', async () => {
    const { api, sandbox } = setup({ container: { id: 'c1', createdAt: CREATED_AT } });
    api.containers = [
      { id: 'c1', createdAt: '2026-10-08T12:00:01.000Z', status: 'running', expiresAt: '2026-10-09T12:00:00.000Z' },
    ];
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'container_not_running' });
    expect(api.requests.some(r => r.method === 'POST')).toBe(false);
    api.containers[0]!.createdAt = CREATED_AT;
    expect(await sandbox.start()).toEqual({ outcome: 'connected' });
  });

  it('keeps a creation recovery key after an ambiguous start and refuses to claim cleanup', async () => {
    const { api, sandbox } = setup({ creationKey: 'recovery-key', startupTimeout: 5 });
    api.starting = true;
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'creation_ambiguous', idempotencyKey: 'recovery-key' });
    await expect(sandbox._destroy()).rejects.toMatchObject({
      code: 'creation_unresolved',
      idempotencyKey: 'recovery-key',
    });
    expect(sandbox.creationKey).toBe('recovery-key');
    expect(api.requests.some(r => r.method === 'DELETE')).toBe(false);
  });

  it('cleans up a created generation even when the onStart hook failed', async () => {
    const { api, sandbox } = setup({
      onStart: () => {
        throw new Error('setup failed');
      },
    });
    await expect(sandbox.start()).rejects.toThrow('setup failed');
    await sandbox._destroy();
    expect(api.containers).toEqual([]);
    expect(sandbox.status).toBe('destroyed');
  });

  it('needs no cleanup after a definitive creation admission rejection', async () => {
    const { api, sandbox } = setup();
    api.rejectCreation = true;
    await expect(sandbox.start()).rejects.toMatchObject({ status: 402 });
    await sandbox._destroy();
    expect(sandbox.status).toBe('destroyed');
    expect(api.requests.some(r => r.method === 'DELETE')).toBe(false);
  });

  it('confirms exact-generation absence after fenced cleanup and preserves a replacement', async () => {
    const { api, sandbox } = setup();
    await sandbox.start();
    api.containers[0]!.createdAt = '2026-10-08T12:00:01.000Z';
    api.cleanupConflict = true;
    await sandbox._destroy();
    expect(api.containers).toHaveLength(1);
    expect(api.containers[0]!.createdAt).not.toBe(CREATED_AT);
    const deletion = api.requests.find(r => r.method === 'DELETE');
    expect(deletion?.url.searchParams.get('createdAt')).toBe(CREATED_AT);
  });

  it('does not swallow cleanup failures while the exact generation remains present', async () => {
    const { api, sandbox } = setup();
    await sandbox.start();
    api.cleanupConflict = true;
    await expect(sandbox._destroy()).rejects.toMatchObject({ code: 'container_not_running' });
    expect(sandbox.container).toBeDefined();
    expect(sandbox.status).toBe('error');
  });

  it('uses a fresh creation key after an explicit destructive stop', async () => {
    const { sandbox } = setup();
    await sandbox.start();
    const key = sandbox.creationKey;
    await sandbox._stop();
    expect(sandbox.container).toBeUndefined();
    expect(await sandbox.start()).toEqual({ outcome: 'created' });
    expect(sandbox.creationKey).not.toBe(key);
  });

  it('checks readiness against the exact remote generation and excludes credentials from metadata', async () => {
    const { api, sandbox } = setup();
    await sandbox.start();
    expect(await sandbox.isReady()).toBe(true);
    const info = await sandbox.getInfo();
    expect(info.timeoutAt).toEqual(new Date('2026-10-09T12:00:00.000Z'));
    expect(JSON.stringify(info)).not.toContain(API_KEY);
    api.containers = [];
    expect(await sandbox.isReady()).toBe(false);
  });

  it('copies configuration without reusing remote identity or creation keys', async () => {
    const { sandbox } = setup({
      container: { id: 'c1', createdAt: CREATED_AT },
      creationKey: 'original',
      env: { A: 'one' },
    });
    const clone = sandbox.clone({ id: 'clone', env: { B: 'two' } });
    expect(clone.id).toBe('clone');
    expect(clone.container).toBeUndefined();
    expect(clone.creationKey).not.toBe(sandbox.creationKey);
    expect(clone.getEnv()).toEqual({ B: 'two' });
    expect(() => sandbox.clone({ sandboxId: 'c1' })).toThrow('does not support');
  });

  it('uploads binary files and rejects explicit permission modes before starting', async () => {
    const { api, sandbox } = setup();
    await expect(sandbox.writeFiles([{ path: 'test', content: 'x', mode: 0o755 }])).rejects.toThrow('permission modes');
    expect(api.requests).toEqual([]);
    await sandbox.writeFiles([{ path: 'input/probe.bin', content: Buffer.from([0, 255, 128]) }]);
    expect(api.files.get('/workspace/input/probe.bin')).toEqual(Buffer.from([0, 255, 128]));
  });

  it('gates managed execution before provisioning', async () => {
    const { api, sandbox } = setup();
    api.capabilities.execution.background = false;
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'managed_execution_unavailable' });
    expect(api.requests.some(r => r.url.pathname === '/containers')).toBe(false);
  });

  it('does not leave an unresolved creation when an optional policy is unavailable', async () => {
    const { api, sandbox } = setup({ internet: false });
    api.capabilities.networking.internetControl = false;
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'network_policy_unavailable' });
    await sandbox._destroy();
    expect(sandbox.status).toBe('destroyed');
    expect(api.requests.some(request => request.method === 'POST')).toBe(false);
  });

  it('caches bearer preview URLs and does not reissue after an uncertain response', async () => {
    const { api, sandbox } = setup();
    await sandbox.start();
    expect(await sandbox.networking.getPortUrl(3000)).toBe('https://private-preview.example');
    expect(await sandbox.networking.getPortUrl(3000)).toBe('https://private-preview.example');
    api.failPreview = true;
    await expect(sandbox.networking.getPortUrl(4000)).rejects.toMatchObject({ code: 'transport_unavailable' });
    await expect(sandbox.networking.getPortUrl(4000)).rejects.toMatchObject({ code: 'transport_unavailable' });
    expect(api.requests.filter(r => r.url.pathname === '/containers/previews')).toHaveLength(2);
  });

  it('exposes an editor provider and validates exclusive creation selectors', () => {
    expect(mainbrellaSandboxProvider.createSandbox({ timeout: 1000 })).toBeInstanceOf(MainbrellaSandbox);
    expect(mainbrellaSandboxProvider.id).toBe('mainbrella');
    expect(() => setup({ catalogId: 'node', imageId: 'custom' })).toThrow('Specify only one');
    expect(() => setup({ timeout: 900001 })).toThrow('timeout');
  });
});
