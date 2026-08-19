import { describe, expect, it, vi } from 'vitest';

import { PI_EXTENSION_NOT_INITIALIZED_ERROR, MastraPiExtensionGeneration } from '../runtime.js';
import type { PiExtensionApi } from '../types.js';

function createGeneration() {
  return new MastraPiExtensionGeneration('fixture.package', 'fixture.extension', '/tmp/fixture.ts');
}

describe('MastraPiExtensionGeneration', () => {
  it('captures registrations and reports unsupported, gated, unknown, and duplicate capabilities', () => {
    const generation = createGeneration();
    const api = generation.createApi({ enabled: false });
    const firstTool = { name: 'echo', label: 'Echo', description: 'first' };

    api.registerTool(firstTool);
    api.registerTool({ ...firstTool, description: 'duplicate' });
    api.registerShortcut('ctrl+x', { handler: () => {} });
    api.registerFlag('enabled', { type: 'boolean', default: true });
    api.registerMarkdownTransformer(value => value);
    api.registerEntryRenderer('state', value => value);
    api.registerProvider('declarative', { baseUrl: 'https://example.invalid', models: [] });
    api.registerProvider({ id: 'native-provider' });
    api.on('session_start', () => {});
    api.on('session_tree', () => {});
    api.on('future_event', () => {});
    const futureApi = api as PiExtensionApi & { futureRegistration(): void };
    expect(() => futureApi.futureRegistration()).toThrow('called unknown API futureRegistration');

    expect(generation.registrations.tools.get('echo')).toBe(firstTool);
    expect(api.getFlag('enabled')).toBe(false);
    expect(generation.compatibility.status).toBe('pi-partial');
    expect(
      Object.fromEntries(generation.compatibility.capabilities.map(item => [item.name, item.support])),
    ).toMatchObject({
      registerTool: 'adapted',
      registerShortcut: 'version-gated',
      registerMarkdownTransformer: 'unsupported',
      registerEntryRenderer: 'unsupported',
      registerProvider: 'adapted',
      registerNativeProvider: 'unsupported',
      'event:session_start': 'adapted',
      'event:session_tree': 'unsupported',
      'event:future_event': 'unsupported',
    });
    expect(generation.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ extensionId: 'fixture.extension', capability: 'registerTool', severity: 'warning' }),
        expect.objectContaining({ capability: 'event:future_event', severity: 'error' }),
      ]),
    );
  });

  it('preserves registration-only loading, binds actions once, and rejects stale contexts', async () => {
    const generation = createGeneration();
    const api = generation.createApi();

    expect(() => api.sendMessage({ customType: 'notice' })).toThrow(PI_EXTENSION_NOT_INITIALIZED_ERROR);

    const sendMessage = vi.fn();
    generation.bind({ sendMessage });
    api.sendMessage({ customType: 'notice' });
    expect(sendMessage).toHaveBeenCalledWith({ customType: 'notice' });
    expect(() => generation.bind()).toThrow('already bound');

    await generation.invalidate();
    expect(generation.active).toBe(false);
    expect(() => api.registerTool({ name: 'late' })).toThrow('context is stale');
    expect(() => api.sendMessage({ customType: 'late' })).toThrow('context is stale');
  });

  it('attributes unavailable post-bind actions instead of silently ignoring them', () => {
    const generation = createGeneration();
    const api = generation.createApi();
    generation.bind();

    expect(() => api.getCommands()).toThrow('runtime adapter is unavailable');
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ extensionId: 'fixture.extension', capability: 'getCommands', severity: 'error' }),
    );
  });

  it('runs every owned cleanup and isolates failures during invalidation', async () => {
    const generation = createGeneration();
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn(() => Promise.reject(new Error('transport failed')));
    generation.addCleanup(firstCleanup);
    generation.addCleanup(secondCleanup);

    await expect(generation.invalidate()).resolves.toBeUndefined();

    expect(firstCleanup).toHaveBeenCalledOnce();
    expect(secondCleanup).toHaveBeenCalledOnce();
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'cleanup', message: expect.stringContaining('transport failed') }),
    );
  });

  it('owns event-bus subscriptions and removes them on unsubscribe or invalidation', async () => {
    const generation = createGeneration();
    const api = generation.createApi();
    const handler = vi.fn();
    const unsubscribe = api.events.on('channel', handler);

    api.events.emit('channel', 1);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(1));
    unsubscribe();
    api.events.emit('channel', 2);
    expect(handler).toHaveBeenCalledTimes(1);

    api.events.on('channel', handler);
    await generation.invalidate();
    expect(() => api.events.emit('channel', 3)).toThrow('context is stale');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
