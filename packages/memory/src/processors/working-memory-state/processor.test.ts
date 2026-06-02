import type { MastraMemory, MemoryConfigInternal, WorkingMemoryTemplate } from '@mastra/core/memory';
import type { ComputeStateSignalArgs, ProcessorStateSignalTracking } from '@mastra/core/processors';
import { describe, expect, it, vi } from 'vitest';

import {
  stableWorkingMemoryCacheKey,
  WORKING_MEMORY_STATE_ID,
  WORKING_MEMORY_STATE_PROCESSOR_ID,
  WorkingMemoryStateProcessor,
} from './processor';

function buildMemoryMock({
  template,
  data,
  scope = 'resource',
}: {
  template: WorkingMemoryTemplate | null;
  data: string | null;
  scope?: 'thread' | 'resource';
}): MastraMemory {
  return {
    getWorkingMemoryTemplate: vi.fn(async () => template),
    getWorkingMemory: vi.fn(async () => data),
    getMergedThreadConfig: vi.fn((cfg?: MemoryConfigInternal) => ({
      ...cfg,
      workingMemory: { enabled: true, scope, useStateSignals: true, ...(cfg?.workingMemory ?? {}) },
    })),
  } as unknown as MastraMemory;
}

function buildArgs(overrides: Partial<ComputeStateSignalArgs> = {}): ComputeStateSignalArgs {
  return {
    stepNumber: 0,
    steps: [],
    state: {} as ComputeStateSignalArgs['state'],
    resourceId: 'resource-1',
    threadId: 'thread-1',
    activeStateSignals: [],
    contextWindow: { hasSnapshot: false },
    lastSnapshot: undefined,
    deltasSinceSnapshot: [],
    tracking: undefined,
    ...overrides,
  } as ComputeStateSignalArgs;
}

describe('WorkingMemoryStateProcessor', () => {
  it('exports stable id and stateId', () => {
    expect(WORKING_MEMORY_STATE_PROCESSOR_ID).toBe('working-memory-state');
    expect(WORKING_MEMORY_STATE_ID).toBe('working-memory');
    const memory = buildMemoryMock({ template: null, data: null });
    const processor = new WorkingMemoryStateProcessor(memory);
    expect(processor.id).toBe(WORKING_MEMORY_STATE_PROCESSOR_ID);
    expect(processor.stateId).toBe(WORKING_MEMORY_STATE_ID);
  });

  it('returns nothing when no working memory template is configured', async () => {
    const memory = buildMemoryMock({ template: null, data: null });
    const processor = new WorkingMemoryStateProcessor(memory);
    const result = await processor.computeStateSignal(buildArgs());
    expect(result).toBeUndefined();
  });

  it('emits a snapshot state signal on first run', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: '# Title\n- field' };
    const memory = buildMemoryMock({ template, data: '# Title\n- ready' });
    const processor = new WorkingMemoryStateProcessor(memory);

    const result = await processor.computeStateSignal(buildArgs());

    expect(result).toMatchObject({
      id: WORKING_MEMORY_STATE_ID,
      mode: 'snapshot',
      tagName: 'working-memory',
    });
    expect(result?.cacheKey).toBe(stableWorkingMemoryCacheKey({ format: 'markdown', data: '# Title\n- ready' }));
    // Plain text contents — runtime wraps in <working-memory ...>…</working-memory> via tagName.
    expect(result?.contents).toBe('# Title\n- ready');
    expect(result?.contents).not.toContain('<working_memory_');
    expect(result?.value).toEqual({ data: '# Title\n- ready' });
    expect(result?.attributes).toMatchObject({ format: 'markdown', scope: 'resource' });
  });

  it('dedups when cacheKey is unchanged and snapshot is still in the context window', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: 'tpl' };
    const data = '# unchanged';
    const memory = buildMemoryMock({ template, data });
    const processor = new WorkingMemoryStateProcessor(memory);

    const cacheKey = stableWorkingMemoryCacheKey({ format: 'markdown', data });
    const tracking: ProcessorStateSignalTracking = {
      currentCacheKey: cacheKey,
      currentMode: 'snapshot',
      version: 1,
      lastSignalId: 'state:working-memory:1',
      lastSnapshotSignalId: 'state:working-memory:1',
      updatedAt: new Date().toISOString(),
      activeCopies: [],
    };

    const result = await processor.computeStateSignal(
      buildArgs({
        tracking,
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {} as ComputeStateSignalArgs['lastSnapshot'],
      }),
    );

    expect(result).toBeUndefined();
  });

  it('re-emits the snapshot when the previous snapshot has dropped out of the context window', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: 'tpl' };
    const data = '# unchanged';
    const memory = buildMemoryMock({ template, data });
    const processor = new WorkingMemoryStateProcessor(memory);

    const cacheKey = stableWorkingMemoryCacheKey({ format: 'markdown', data });
    const tracking: ProcessorStateSignalTracking = {
      currentCacheKey: cacheKey,
      currentMode: 'snapshot',
      version: 1,
      lastSignalId: 'state:working-memory:1',
      lastSnapshotSignalId: 'state:working-memory:1',
      updatedAt: new Date().toISOString(),
      activeCopies: [],
    };

    const result = await processor.computeStateSignal(
      buildArgs({
        tracking,
        contextWindow: { hasSnapshot: false },
        lastSnapshot: {} as ComputeStateSignalArgs['lastSnapshot'],
      }),
    );

    expect(result).toBeDefined();
    expect(result?.cacheKey).toBe(cacheKey);
    expect(result?.mode).toBe('snapshot');
  });

  it('emits a fresh snapshot when the working memory data changes', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: 'tpl' };
    const memory = buildMemoryMock({ template, data: '# new' });
    const processor = new WorkingMemoryStateProcessor(memory);

    const oldCacheKey = stableWorkingMemoryCacheKey({ format: 'markdown', data: '# old' });
    const tracking: ProcessorStateSignalTracking = {
      currentCacheKey: oldCacheKey,
      currentMode: 'snapshot',
      version: 1,
      lastSignalId: 'state:working-memory:1',
      lastSnapshotSignalId: 'state:working-memory:1',
      updatedAt: new Date().toISOString(),
      activeCopies: [],
    };

    const result = await processor.computeStateSignal(
      buildArgs({
        tracking,
        contextWindow: { hasSnapshot: true },
        lastSnapshot: {} as ComputeStateSignalArgs['lastSnapshot'],
      }),
    );

    expect(result).toBeDefined();
    expect(result?.cacheKey).not.toBe(oldCacheKey);
    expect(result?.mode).toBe('snapshot');
    expect(result?.contents).toContain('# new');
  });

  it('emits no signal when no working memory data is stored yet', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
    const memory = buildMemoryMock({ template, data: null });
    const processor = new WorkingMemoryStateProcessor(memory);
    const result = await processor.computeStateSignal(buildArgs());
    expect(result).toBeUndefined();
  });

  it('emits no signal when working memory data is whitespace-only', async () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
    const memory = buildMemoryMock({ template, data: '   \n  ' });
    const processor = new WorkingMemoryStateProcessor(memory);
    const result = await processor.computeStateSignal(buildArgs());
    expect(result).toBeUndefined();
  });

  it('produces compact, stable, content-addressed cacheKeys', () => {
    const longBlob = '# User Profile\n' + '- Name: Caleb\n'.repeat(1000);
    const a = stableWorkingMemoryCacheKey({ format: 'markdown', data: longBlob });
    const b = stableWorkingMemoryCacheKey({ format: 'markdown', data: longBlob });
    const c = stableWorkingMemoryCacheKey({ format: 'markdown', data: longBlob + 'change' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    // sha256 hex digest + prefix is always 71 chars, regardless of payload size.
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a.length).toBe(71);
  });

  it('treats format as part of the cache key', () => {
    const md = stableWorkingMemoryCacheKey({ format: 'markdown', data: '{}' });
    const json = stableWorkingMemoryCacheKey({ format: 'json', data: '{}' });
    expect(md).not.toBe(json);
  });
});
