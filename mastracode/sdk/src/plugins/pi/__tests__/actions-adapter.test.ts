import { describe, expect, it, vi } from 'vitest';

import { createPiRuntimeActions, getPiActiveToolRequest, type PiActionHost } from '../actions-adapter.js';
import { PiCommandAdapter } from '../command-adapter.js';
import { createPiProcessorAdapters } from '../processor-adapter.js';
import { PiProviderAdapter } from '../provider-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

function fixture() {
  const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
  const setActiveTools = vi.fn().mockResolvedValue(undefined);
  const host: PiActionHost = {
    getMessageSession: () => undefined,
    getThreadHost: () => undefined,
    getStateBackend: () => undefined,
    getModelHost: () => undefined,
    listTools: vi.fn().mockResolvedValue(['allowed', 'other']),
    getActiveTools: vi.fn().mockResolvedValue(['allowed', 'other']),
    setActiveTools,
    refreshTools: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', code: 0 }),
    isIdle: () => true,
    waitForIdle: vi.fn().mockResolvedValue(undefined),
    getPendingMessages: () => ({ followUps: 1 }),
    abort: vi.fn(),
    getContextUsage: () => ({ inputTokens: 3 }),
    getSystemPrompt: () => 'sanitized',
  };
  const providers = new PiProviderAdapter({
    register: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  });
  return {
    generation,
    host,
    setActiveTools,
    actions: createPiRuntimeActions({ generation, host, commands: new PiCommandAdapter(), providers }),
  };
}

describe('Pi runtime actions', () => {
  it('enforces host tool policy and exposes narrow idle, usage, prompt, and exec facades', async () => {
    const { generation, actions, setActiveTools, host } = fixture();
    await generation.bind(actions);
    const api = generation.createApi();

    await expect(api.setActiveTools(['allowed'])).resolves.toBeUndefined();
    expect(setActiveTools).toHaveBeenCalledWith(['allowed']);
    expect(getPiActiveToolRequest(generation)).toEqual(['allowed']);
    const { input } = createPiProcessorAdapters(generation, '/workspace');
    expect(
      input[0]!.processInputStep?.({ tools: { allowed: {}, other: {} }, activeTools: ['allowed', 'other'] } as never),
    ).toEqual({ activeTools: ['allowed'] });
    await expect(api.setActiveTools(['missing'])).rejects.toThrow('unavailable tools');
    expect(api.isIdle()).toBe(true);
    expect(api.getContextUsage()).toEqual({ inputTokens: 3 });
    expect(api.getPendingMessages()).toEqual({ followUps: 1 });
    await expect(api.refreshTools()).resolves.toBeUndefined();
    expect(api.getSystemPrompt()).toBe('sanitized');
    await expect(api.exec('echo', ['ok'], { cwd: '/workspace' })).resolves.toEqual({
      stdout: 'ok',
      stderr: '',
      code: 0,
    });
    expect(host.exec).toHaveBeenCalledWith('echo', ['ok'], { cwd: '/workspace' });
  });

  it('cancels waitForIdle when the generation becomes stale', async () => {
    const { generation, host } = fixture();
    host.waitForIdle = vi.fn(
      signal =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    const actions = createPiRuntimeActions({
      generation,
      host,
      commands: new PiCommandAdapter(),
      providers: new PiProviderAdapter({
        register: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    });
    await generation.bind(actions);
    const waiting = generation.createApi().waitForIdle();

    await generation.invalidate();
    await expect(waiting).rejects.toThrow('stale');
  });

  it('rejects malformed action facade inputs before they reach host adapters', async () => {
    const { generation, actions } = fixture();
    await generation.bind(actions);
    const api = generation.createApi();

    expect(() => api.sendMessage('hello', { triggerTurn: 'true' } as never)).toThrow('triggerTurn');
    expect(() => api.sendUserMessage('hello', { deliverAs: 'invalid' } as never)).toThrow('deliverAs');
    expect(() => api.setModel({ id: 42 } as never)).toThrow('id must be a string');
    expect(() => api.newSession({ name: 42 } as never)).toThrow('name must be a string');
    expect(() => api.fork({ sourceThreadId: 42 } as never)).toThrow('sourceThreadId must be a string');
    expect(() => api.switchSession(42 as never)).toThrow('thread ID');
  });

  it('rejects every facade after generation invalidation', async () => {
    const { generation, actions } = fixture();
    await generation.bind(actions);
    const api = generation.createApi();
    await generation.invalidate();
    expect(() => api.isIdle()).toThrow('stale');
  });
});
