import { describe, expect, it, vi } from 'vitest';

import { MastraPiExtensionGeneration } from '../runtime.js';
import { PiThreadAdapter, type PiThreadHost, type PiThreadInfo } from '../thread-adapter.js';

function fixture() {
  const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
  const threads = new Map<string, PiThreadInfo>([['current', { id: 'current', title: 'Current' }]]);
  let current = 'current';
  const host: PiThreadHost = {
    getId: () => current,
    create: vi.fn().mockImplementation(async ({ title } = {}) => {
      const thread = { id: 'new', title };
      threads.set(thread.id, thread);
      current = thread.id;
      return thread;
    }),
    switch: vi.fn().mockImplementation(async ({ threadId }) => {
      if (!threads.has(threadId)) throw new Error(`Thread not found: ${threadId}`);
      current = threadId;
    }),
    clone: vi.fn().mockImplementation(async ({ sourceThreadId }) => {
      const source = sourceThreadId ?? current;
      if (!threads.has(source)) throw new Error(`Thread not found: ${source}`);
      const thread = { id: 'fork', title: 'Fork' };
      threads.set(thread.id, thread);
      current = thread.id;
      return thread;
    }),
    rename: vi.fn().mockImplementation(async ({ title }) => {
      const thread = threads.get(current);
      if (thread) thread.title = title;
    }),
    getById: async ({ threadId }) => threads.get(threadId) ?? null,
  };
  return { generation, host, adapter: new PiThreadAdapter(generation, () => host) };
}

describe('Pi thread adapter', () => {
  it('maps new, switch, fork, and session names to host-owned threads', async () => {
    const { adapter } = fixture();
    await expect(adapter.newSession({ name: 'New' })).resolves.toEqual({ cancelled: false, threadId: 'new' });
    await expect(adapter.switchSession('missing')).resolves.toEqual({ cancelled: true });
    await expect(adapter.switchSession('current')).resolves.toEqual({ cancelled: false, threadId: 'current' });
    await expect(adapter.fork()).resolves.toEqual({ cancelled: false, threadId: 'fork' });
    await expect(adapter.fork({ sourceThreadId: 'outside-resource' })).rejects.toThrow('Thread not found');
    await adapter.setSessionName('Renamed');
    await expect(adapter.getSessionName()).resolves.toBe('Renamed');
  });

  it('returns an explicit unsupported result for Pi transcript-tree navigation', () => {
    const { adapter, generation } = fixture();
    expect(adapter.navigateTree()).toMatchObject({ supported: false });
    expect(generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'navigateTree')).toBe(
      true,
    );
  });
});
