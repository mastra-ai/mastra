import type { MastraMemory, MemoryConfigInternal, WorkingMemoryTemplate } from '@mastra/core/memory';
import type {
  ComputeStateSignalArgs,
  ProcessorActiveStateSignal,
  ProcessorStateSignalTracking,
} from '@mastra/core/processors';
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
    expect(result?.attributes).toMatchObject({ format: 'markdown', scope: 'resource' });
    // `value` mirrors the full post-edit text so the next delta has typed prior
    // state to diff against. Invisible to the model.
    expect(result?.value).toBe('# Title\n- ready');
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

  describe('delta emission', () => {
    const priorSnapshot = (contents: string): ComputeStateSignalArgs['lastSnapshot'] =>
      ({
        contents,
        metadata: { state: { mode: 'snapshot', version: 1 } },
      }) as unknown as ComputeStateSignalArgs['lastSnapshot'];

    it('emits a unified-diff delta when a prior markdown snapshot exists in the window', async () => {
      const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
      const base =
        '# User Profile\n' + Array.from({ length: 30 }, (_, i) => `- Field ${i}: value ${i}`).join('\n') + '\n';
      const prior = base + '- Favorite color: orange\n';
      const next = base + '- Favorite color: blue\n';
      const memory = buildMemoryMock({ template, data: next });
      const processor = new WorkingMemoryStateProcessor(memory);

      const result = await processor.computeStateSignal(
        buildArgs({
          contextWindow: { hasSnapshot: true },
          lastSnapshot: priorSnapshot(prior),
          deltasSinceSnapshot: [],
          tracking: {
            currentCacheKey: stableWorkingMemoryCacheKey({ format: 'markdown', data: prior }),
            currentMode: 'snapshot',
            version: 1,
          },
        }),
      );

      expect(result?.mode).toBe('delta');
      expect(result?.attributes).toMatchObject({ format: 'markdown', scope: 'resource', patch: 'unified-diff' });
      // Unified diff hunk markers should appear in contents.
      expect(result?.contents).toMatch(/@@/);
      expect(result?.contents).toContain('-- Favorite color: orange');
      expect(result?.contents).toContain('+- Favorite color: blue');
      // Cache key still matches the full next contents (after trim, same as processor).
      expect(result?.cacheKey).toBe(stableWorkingMemoryCacheKey({ format: 'markdown', data: next.trim() }));
      // Patch must be strictly smaller than a full snapshot for delta to win.
      expect((result?.contents as string).length).toBeLessThan(next.length);
      // Delta carries the full post-edit text on `value` so the next turn can
      // diff incrementally instead of re-diffing against the older snapshot.
      expect(result?.value).toBe(next.trim());
    });

    it('diffs against the latest delta value rather than the stale snapshot', async () => {
      // Simulates: snapshot A → delta B (against A) → delta C (should diff against B, not A).
      const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
      const base =
        '# User Profile\n' + Array.from({ length: 30 }, (_, i) => `- Field ${i}: value ${i}`).join('\n') + '\n';
      const snapshotA = base + '- Favorite color: orange\n';
      const deltaB = base + '- Favorite color: blue\n';
      const next = base + '- Favorite color: green\n';
      const memory = buildMemoryMock({ template, data: next });
      const processor = new WorkingMemoryStateProcessor(memory);

      const priorDelta = {
        contents: '@@ stale-diff @@',
        metadata: { state: { mode: 'delta', version: 2 }, value: deltaB },
      } as unknown as ProcessorActiveStateSignal;

      const result = await processor.computeStateSignal(
        buildArgs({
          contextWindow: { hasSnapshot: true },
          lastSnapshot: priorSnapshot(snapshotA),
          deltasSinceSnapshot: [priorDelta],
          tracking: {
            currentCacheKey: stableWorkingMemoryCacheKey({ format: 'markdown', data: deltaB }),
            currentMode: 'delta',
            version: 2,
          },
        }),
      );

      expect(result?.mode).toBe('delta');
      // Diff was computed against deltaB (blue → green), not snapshotA (orange → green).
      expect(result?.contents).toContain('-- Favorite color: blue');
      expect(result?.contents).toContain('+- Favorite color: green');
      expect(result?.contents).not.toContain('orange');
      expect(result?.value).toBe(next.trim());
    });

    it('falls back to a snapshot when the prior snapshot dropped out of the window', async () => {
      const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
      const next = '# User Profile\n- Name: Caleb\n- Favorite color: blue\n';
      const memory = buildMemoryMock({ template, data: next });
      const processor = new WorkingMemoryStateProcessor(memory);

      const result = await processor.computeStateSignal(
        buildArgs({
          contextWindow: { hasSnapshot: false },
          lastSnapshot: priorSnapshot('# anything'),
        }),
      );

      expect(result?.mode).toBe('snapshot');
      expect(result?.contents).toBe(next.trim());
    });

    it('emits a delta even when the unified-diff payload is not smaller than the next snapshot', async () => {
      const template: WorkingMemoryTemplate = { format: 'markdown', content: '# tpl' };
      const prior = 'a';
      const next = 'b';
      const memory = buildMemoryMock({ template, data: next });
      const processor = new WorkingMemoryStateProcessor(memory);

      const result = await processor.computeStateSignal(
        buildArgs({
          contextWindow: { hasSnapshot: true },
          lastSnapshot: priorSnapshot(prior),
        }),
      );

      expect(result?.mode).toBe('delta');
      expect(result?.contents).toContain('-a');
      expect(result?.contents).toContain('+b');
      expect(result?.value).toBe('b');
    });

    it('never emits a delta in schema mode (always snapshot)', async () => {
      const template: WorkingMemoryTemplate = {
        format: 'json',

        content: { type: 'object' } as any,
      };
      const next = '{"name":"Caleb","color":"blue"}';
      const memory = buildMemoryMock({ template, data: next });
      const processor = new WorkingMemoryStateProcessor(memory);

      const result = await processor.computeStateSignal(
        buildArgs({
          contextWindow: { hasSnapshot: true },
          lastSnapshot: priorSnapshot('{"name":"Caleb","color":"orange"}'),
        }),
      );

      expect(result?.mode).toBe('snapshot');
      expect(result?.contents).toBe(next);
    });
  });
});
