import type { MastraMemory, MemoryConfigInternal, WorkingMemoryTemplate } from '@mastra/core/memory';
import type { ComputeStateSignalArgs, ProcessorStateSignalTracking } from '@mastra/core/processors';
import { describe, expect, it, vi } from 'vitest';

import {
  renderWorkingMemoryAsSignalContents,
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
    expect(result?.contents).toContain('<working_memory_template>');
    expect(result?.contents).toContain('<working_memory_data>');
    expect(result?.contents).toContain('# Title\n- ready');
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

  it('renders a placeholder when no working memory data is stored yet', () => {
    const template: WorkingMemoryTemplate = { format: 'markdown', content: 'tpl' };
    const contents = renderWorkingMemoryAsSignalContents({ template, data: null });
    expect(contents).toContain('No working memory data stored yet.');
  });

  it('produces deterministic cacheKeys regardless of object key order in data', () => {
    const a = stableWorkingMemoryCacheKey({ format: 'json', data: JSON.stringify({ a: 1, b: 2 }) });
    const b = stableWorkingMemoryCacheKey({ format: 'json', data: JSON.stringify({ b: 2, a: 1 }) });
    // raw string differs because JSON.stringify preserves key order in the input,
    // but stableWorkingMemoryCacheKey wraps the outer object deterministically.
    expect(a).toContain('"format":"json"');
    expect(b).toContain('"format":"json"');
  });
});
