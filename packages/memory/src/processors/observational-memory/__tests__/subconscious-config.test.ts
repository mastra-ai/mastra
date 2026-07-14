import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory, Subconscious } from '../../../index';
import type { Extractor } from '../extractor';
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
        { name: 'capture', builtIn: true, maxSteps: 5 },
        { name: 'remind', builtIn: true, maxSteps: 5 },
      ],
      reflection: [
        { name: 'curate', builtIn: true, maxSteps: 5 },
        { name: 'learn', builtIn: true, maxSteps: 5 },
      ],
      defaultScope: 'resource',
      learnedGuidance: true,
      tools: true,
      activity: { recentUpdates: 10 },
    });
  });

  it('supports disabling phases and resolves global and per-agent options', () => {
    const subconscious = new Subconscious({
      observation: [],
      reflection: [{ name: 'curate', model, instructions: 'Prefer canonical project names.', maxSteps: 3 }],
      model: 'openai/gpt-5-mini',
      defaultScope: 'thread',
      maxScope: 'resource',
      learnedGuidance: false,
      tools: false,
      activity: false,
      maxSteps: 7,
    });

    expect(subconscious.resolved.observation).toEqual([]);
    expect(subconscious.resolved.reflection[0]).toMatchObject({
      name: 'curate',
      model,
      instructions: 'Prefer canonical project names.',
      maxSteps: 3,
    });
    expect(subconscious.resolved).toMatchObject({
      defaultScope: 'thread',
      maxScope: 'resource',
      learnedGuidance: false,
      tools: false,
      activity: false,
    });
  });

  it('validates custom agents, duplicate names, and bounds', () => {
    expect(() => new Subconscious({ observation: ['capture', 'capture'] })).toThrow(/Duplicate/);
    expect(() => new Subconscious({ observation: ['unknown' as 'capture'] })).toThrow(/Unknown/);
    expect(() => new Subconscious({ observation: [{ name: 'ticket', schema: z.string() } as any] })).toThrow(
      /requires schema and onExtracted/,
    );
    expect(
      () => new Subconscious({ observation: [{ name: 'capture', schema: z.object({ value: z.string() }) }] }),
    ).toThrow(/custom capture schema requires an onExtracted hook/i);
    expect(() => new Subconscious({ reflection: [{ name: 'audit' }] })).toThrow(/requires instructions or agent/);
    expect(() => new Subconscious({ activity: { recentUpdates: 101 } })).toThrow(/between 1 and 100/);
    expect(() => new Subconscious({ maxSteps: 0 })).toThrow(/between 1 and 25/);
  });

  it('compiles capture and custom observation hooks into the shared extractor list', () => {
    const onExtracted = vi.fn();
    const subconscious = new Subconscious({
      observation: ['capture', { name: 'ticket', schema: z.object({ ids: z.array(z.string()) }), onExtracted }],
      reflection: [],
    });
    const memory = new Memory({
      storage: new InMemoryStore(),
      ...semanticInfrastructure,
      options: { observationalMemory: { model, subconscious } },
    });

    const extractors = getExtractors(memory);
    expect(extractors.map(extractor => [extractor.slug, extractor.mode])).toEqual([
      ['capture', 'structured'],
      ['ticket', 'structured'],
    ]);
  });

  it('fails initialization explicitly when semantic infrastructure is missing', () => {
    expect(
      () =>
        new Memory({
          storage: new InMemoryStore(),
          options: { observationalMemory: { model, subconscious: new Subconscious() } },
        }),
    ).toThrow(/requires a vector store/);
  });

  it('fails OM initialization when the storage adapter has no knowledge domain', async () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      ...semanticInfrastructure,
      options: { observationalMemory: { model, subconscious: new Subconscious() } },
    });
    const originalGetStore = memory.storage.getStore.bind(memory.storage);
    vi.spyOn(memory.storage, 'getStore').mockImplementation(async name =>
      name === 'knowledge' ? undefined : originalGetStore(name),
    );

    await expect(memory.omEngine).rejects.toThrow(/Knowledge storage domain is not available/);
  });

  it('does not alter observational memory when Subconscious is absent', () => {
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: { observationalMemory: { model, observation: { extract: [] } } },
    });
    expect(getExtractors(memory)).toEqual([]);
  });
});
