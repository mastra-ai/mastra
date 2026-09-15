import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory, Subconscious } from '../../../index';
import type { Extractor } from '../extractor';
import { usableObservationalMemoryModel } from '../subconscious/model';
import type { ObservationalMemoryConfig } from '../types';

const model = 'openai/gpt-5';

function getExtractors(memory: Memory): Extractor<unknown>[] {
  const config = memory.getMergedThreadConfig().observationalMemory;
  if (!config || typeof config !== 'object') return [];
  return ((config as ObservationalMemoryConfig).observation?.extract ?? []) as Extractor<unknown>[];
}

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

describe('Subconscious configuration', () => {
  it('resolves the signed defaults and bounded surfacing settings', () => {
    const subconscious = new Subconscious();

    expect(subconscious.resolved).toMatchObject({
      observation: [
        { name: 'remind', builtIn: true, maxSteps: 50 },
        { name: 'curate', builtIn: true, maxSteps: 200 },
      ],
      defaultScope: 'resource',
      tools: true,
      activity: { recentUpdates: 10 },
    });
  });

  it('supports disabling defaults and resolves global and per-agent options', () => {
    const subconscious = new Subconscious({
      observation: [{ name: 'curate', model, instructions: 'Prefer canonical project names.', maxSteps: 3 }],
      model: 'openai/gpt-5-mini',
      defaultScope: 'thread',
      maxScope: 'resource',
      tools: false,
      activity: false,
      maxSteps: 7,
    });

    expect(subconscious.resolved.observation).toHaveLength(1);
    expect(subconscious.resolved.observation[0]).toMatchObject({
      name: 'curate',
      model,
      instructions: 'Prefer canonical project names.',
      maxSteps: 3,
    });
    expect(subconscious.resolved).toMatchObject({
      defaultScope: 'thread',
      maxScope: 'resource',
      tools: false,
      activity: false,
    });
  });

  it('lets a global maxSteps override the per-agent curation default', () => {
    const subconscious = new Subconscious({ maxSteps: 7 });

    expect(subconscious.resolved.observation.map(agent => [agent.name, agent.maxSteps])).toEqual([
      ['remind', 7],
      ['curate', 7],
    ]);
  });

  it('validates custom agents, duplicate names, and bounds', () => {
    expect(() => new Subconscious({ observation: ['remind', 'remind'] })).toThrow(/Duplicate/);
    expect(() => new Subconscious({ observation: ['unknown' as 'remind'] })).toThrow(/Unknown/);
    expect(() => new Subconscious({ observation: [{ name: 'ticket', schema: z.string() } as any] })).toThrow(
      /requires schema and onExtracted/,
    );
    expect(() => new Subconscious({ observation: [{ name: 'audit' }] as any })).toThrow(
      /requires schema and onExtracted/,
    );
    expect(() => new Subconscious({ activity: { recentUpdates: 101 } })).toThrow(/between 1 and 100/);
    expect(() => new Subconscious({ maxSteps: 0 })).toThrow(/between 1 and 500/);
    expect(() => new Subconscious({ maxSteps: 501 })).toThrow(/between 1 and 500/);
    expect(
      () =>
        new Subconscious({
          observation: [{ name: 'ticket', model, schema: z.string(), onExtracted: vi.fn() } as any],
        }),
    ).toThrow(/shares the Observer model/);
  });

  it('compiles custom observation hooks into the shared extractor list', () => {
    const onExtracted = vi.fn();
    const subconscious = new Subconscious({
      observation: [{ name: 'ticket', schema: z.object({ ids: z.array(z.string()) }), onExtracted }],
    });
    const memory = new Memory({
      storage: new InMemoryStore(),
      ...semanticInfrastructure,
      options: { observationalMemory: { model, experimental_subconscious: subconscious } },
    });

    const extractors = getExtractors(memory);
    expect(extractors.map(extractor => [extractor.slug, extractor.mode])).toEqual([['ticket', 'structured']]);
  });

  it('preserves an empty dynamic model list for actionable Agent validation', async () => {
    const dynamicModel = usableObservationalMemoryModel((async () => []) as any);

    expect(typeof dynamicModel).toBe('function');
    await expect((dynamicModel as (context: unknown) => Promise<unknown>)({})).resolves.toEqual([]);
  });

  it('fails initialization explicitly when semantic infrastructure is missing', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          options: { observationalMemory: { model, experimental_subconscious: new Subconscious() } },
        }),
    ).toThrow(/requires a vector store/);
  });

  it('fails OM initialization when the storage adapter has no knowledge domain', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      ...semanticInfrastructure,
      options: { observationalMemory: { model, experimental_subconscious: new Subconscious() } },
    });
    const originalGetStore = memory.storage.getStore.bind(memory.storage);
    vi.spyOn(memory.storage, 'getStore').mockImplementation(async name =>
      name === 'knowledge' ? undefined : originalGetStore(name),
    );

    await expect(memory.omEngine).rejects.toThrow(/Knowledge storage domain is not available/);
  });

  it('rejects the stable-looking configuration key at the type boundary', () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          model,
          // @ts-expect-error Subconscious is intentionally experimental.
          subconscious: new Subconscious(),
        },
      },
    });

    expect(getExtractors(memory)).toEqual([]);
  });

  it('does not alter observational memory when Subconscious is absent', () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { model, observation: { extract: [] } } },
    });
    expect(getExtractors(memory)).toEqual([]);
  });
});
