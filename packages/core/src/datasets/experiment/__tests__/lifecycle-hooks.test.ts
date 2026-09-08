import { describe, it, expect, vi } from 'vitest';
import type { Mastra } from '../../../mastra';
import { EXPERIMENT_ITEM_BEFORE_EACH_FAILED, runExperiment } from '../index';

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

// Storage-free Mastra: hooks are orthogonal to persistence, and running without
// storage keeps these tests focused on hook ordering and error semantics.
const createMastra = () =>
  ({
    getStorage: vi.fn().mockReturnValue(undefined),
    getLogger: vi.fn().mockReturnValue(logger),
  }) as unknown as Mastra;

const items = [
  { id: 'a', input: 'one' },
  { id: 'b', input: 'two' },
];

describe('runExperiment lifecycle hooks', () => {
  it('runs beforeAll once before any item and afterAll once after the run', async () => {
    const calls: string[] = [];
    const mastra = createMastra();

    const summary = await runExperiment(mastra, {
      data: items,
      maxConcurrency: 1,
      beforeAll: () => {
        calls.push('beforeAll');
      },
      afterAll: ({ summary }) => {
        calls.push(`afterAll:${summary.succeededCount}`);
      },
      task: ({ input }) => {
        calls.push(`task:${input}`);
        return input;
      },
    });

    expect(summary.status).toBe('completed');
    expect(calls).toEqual(['beforeAll', 'task:one', 'task:two', 'afterAll:2']);
  });

  it('round-trips inline item metadata in results and completion events', async () => {
    const events: unknown[] = [];
    const summary = await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one', metadata: { source: 'inline' } }],
      task: ({ input }) => input,
      onEvent: event => {
        events.push(event);
      },
    });

    expect(summary.results[0]?.metadata).toEqual({ source: 'inline' });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'experiment.item.completed',
        itemId: 'a',
        metadata: { source: 'inline' },
      }),
    );
  });

  it('protects result metadata from callback mutations', async () => {
    const sourceMetadata = { nested: { value: 'original' } };
    const events: unknown[] = [];

    const summary = await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one', metadata: sourceMetadata }],
      beforeEach: ({ item }) => {
        (item.metadata!.nested as { value: string }).value = 'beforeEach';
      },
      task: ({ input, metadata }) => {
        expect(metadata).toEqual({ nested: { value: 'original' } });
        (metadata!.nested as { value: string }).value = 'task';
        return input;
      },
      afterEach: ({ item, result }) => {
        (item.metadata!.nested as { value: string }).value = 'afterEach-item';
        (result.metadata!.nested as { value: string }).value = 'afterEach-result';
      },
      onEvent: event => {
        events.push(event);
      },
    });

    expect(sourceMetadata).toEqual({ nested: { value: 'original' } });
    expect(summary.results[0]?.metadata).toEqual({ nested: { value: 'original' } });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'experiment.item.completed',
        itemId: 'a',
        metadata: { nested: { value: 'original' } },
      }),
    );
  });

  it('passes experimentId and mastra to run-level hooks', async () => {
    const mastra = createMastra();
    const beforeAll = vi.fn();

    const summary = await runExperiment(mastra, {
      data: items,
      beforeAll,
      task: ({ input }) => input,
    });

    expect(beforeAll).toHaveBeenCalledWith(expect.objectContaining({ experimentId: summary.experimentId, mastra }));
  });

  it('fails the run without executing items when beforeAll throws', async () => {
    const task = vi.fn();

    const summary = await runExperiment(createMastra(), {
      data: items,
      beforeAll: () => {
        throw new Error('seed failed');
      },
      task,
    });

    expect(task).not.toHaveBeenCalled();
    expect(summary.status).toBe('failed');
    expect(summary.skippedCount).toBe(2);
    expect(summary.results).toHaveLength(0);
  });

  it('runs afterAll even when the run fails', async () => {
    const afterAll = vi.fn();

    await runExperiment(createMastra(), {
      data: items,
      beforeAll: () => {
        throw new Error('seed failed');
      },
      afterAll,
      task: () => 'unused',
    });

    expect(afterAll).toHaveBeenCalledTimes(1);
    expect(afterAll.mock.calls[0]![0].summary.status).toBe('failed');
  });

  it('logs and swallows afterAll failures so teardown cannot mask the outcome', async () => {
    logger.error.mockClear();

    const summary = await runExperiment(createMastra(), {
      data: items,
      afterAll: () => {
        throw new Error('cleanup exploded');
      },
      task: ({ input }) => input,
    });

    expect(summary.status).toBe('completed');
    expect(summary.succeededCount).toBe(2);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('cleanup exploded'), expect.anything());
  });

  it('wraps each item with beforeEach and afterEach', async () => {
    const calls: string[] = [];

    await runExperiment(createMastra(), {
      data: items,
      maxConcurrency: 1,
      beforeEach: ({ item }) => {
        calls.push(`before:${item.id}`);
      },
      afterEach: ({ item, result }) => {
        calls.push(`after:${item.id}:${result.output}`);
      },
      task: ({ input }) => {
        calls.push(`task:${input}`);
        return input;
      },
    });

    expect(calls).toEqual(['before:a', 'task:one', 'after:a:one', 'before:b', 'task:two', 'after:b:two']);
  });

  it('exposes item input, groundTruth and metadata to item hooks', async () => {
    const beforeEach = vi.fn();

    await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one', groundTruth: 'ONE', metadata: { tag: 'x' } }],
      beforeEach,
      task: ({ input }) => input,
    });

    expect(beforeEach.mock.calls[0]![0].item).toEqual({
      id: 'a',
      input: 'one',
      groundTruth: 'ONE',
      metadata: { tag: 'x' },
    });
  });

  it('fails only the affected item when beforeEach throws, without running the target', async () => {
    const task = vi.fn(({ input }: { input: unknown }) => input);

    const summary = await runExperiment(createMastra(), {
      data: items,
      maxConcurrency: 1,
      beforeEach: ({ item }) => {
        if (item.id === 'a') throw new Error('seed failed');
      },
      task,
    });

    expect(task).toHaveBeenCalledTimes(1);
    expect(summary.status).toBe('completed');
    expect(summary.failedCount).toBe(1);
    expect(summary.succeededCount).toBe(1);
    expect(summary.results[0]!.error).toMatchObject({
      code: EXPERIMENT_ITEM_BEFORE_EACH_FAILED,
      message: expect.stringContaining('seed failed'),
    });
    expect(summary.results[1]!.error).toBeNull();
  });

  it('does not retry an item whose beforeEach failed', async () => {
    const beforeEach = vi.fn(() => {
      throw new Error('seed failed');
    });

    await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one' }],
      maxRetries: 3,
      beforeEach,
      task: ({ input }) => input,
    });

    expect(beforeEach).toHaveBeenCalledTimes(1);
  });

  it('skips afterEach for an item whose beforeEach failed', async () => {
    const afterEach = vi.fn();

    await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one' }],
      beforeEach: () => {
        throw new Error('seed failed');
      },
      afterEach,
      task: ({ input }) => input,
    });

    expect(afterEach).not.toHaveBeenCalled();
  });

  it('runs afterEach for failed items so cleanup still happens', async () => {
    const afterEach = vi.fn();

    const summary = await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one' }],
      afterEach,
      task: () => {
        throw new Error('target blew up');
      },
    });

    expect(summary.failedCount).toBe(1);
    expect(afterEach).toHaveBeenCalledTimes(1);
    expect(afterEach.mock.calls[0]![0].result.error).toMatchObject({ message: 'target blew up' });
  });

  it('logs and swallows afterEach failures without changing the item outcome', async () => {
    logger.error.mockClear();

    const summary = await runExperiment(createMastra(), {
      data: [{ id: 'a', input: 'one' }],
      afterEach: () => {
        throw new Error('cleanup exploded');
      },
      task: ({ input }) => input,
    });

    expect(summary.succeededCount).toBe(1);
    expect(summary.results[0]!.error).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('cleanup exploded'), expect.anything());
  });

  it('serializes item hooks within a concurrency slot', async () => {
    let active = 0;
    let maxActive = 0;

    await runExperiment(createMastra(), {
      data: [
        { id: 'a', input: 'one' },
        { id: 'b', input: 'two' },
        { id: 'c', input: 'three' },
      ],
      maxConcurrency: 2,
      beforeEach: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 5));
      },
      afterEach: () => {
        active--;
      },
      task: ({ input }) => input,
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
