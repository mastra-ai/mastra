import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory, Subconscious } from '../../../index';
import type { Extractor } from '../extractor';
import { __resetCurationCadenceWarning } from '../subconscious/index';
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
        { name: 'capture', builtIn: true },
        { name: 'remind', builtIn: true, maxSteps: 50 },
      ],
      reflection: [
        { name: 'curate', builtIn: true, maxSteps: 200 },
        { name: 'learn', builtIn: true, maxSteps: 50 },
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

  it('lets a global maxSteps override the per-agent curation default', () => {
    const subconscious = new Subconscious({ maxSteps: 7 });

    expect(subconscious.resolved.reflection.map(agent => [agent.name, agent.maxSteps])).toEqual([
      ['curate', 7],
      ['learn', 7],
    ]);
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
    expect(() => new Subconscious({ maxSteps: 0 })).toThrow(/between 1 and 500/);
    expect(() => new Subconscious({ maxSteps: 501 })).toThrow(/between 1 and 500/);
    expect(() => new Subconscious({ observation: [{ name: 'capture', model, maxSteps: 2 } as any] })).toThrow(
      /shares the Observer model/,
    );
    expect(
      () =>
        new Subconscious({
          observation: [{ name: 'ticket', model, schema: z.string(), onExtracted: vi.fn() } as any],
        }),
    ).toThrow(/shares the Observer model/);
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
      options: { observationalMemory: { model, experimental_subconscious: subconscious } },
    });

    const extractors = getExtractors(memory);
    expect(extractors.map(extractor => [extractor.slug, extractor.mode])).toEqual([
      ['capture', 'structured'],
      ['ticket', 'structured'],
    ]);
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

describe('curationCadence deprecation', () => {
  it('warns once per process, not once per construction', () => {
    __resetCurationCadenceWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      new Subconscious({ curationCadence: 5 });
      new Subconscious({ curationCadence: 9 });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('curationThreshold');
      expect(warn.mock.calls[0]?.[0]).toContain('uncurated');
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn when only the new options are used', () => {
    __resetCurationCadenceWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      new Subconscious({ curationThreshold: 5, curationMaxAgeMs: 60_000 });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('lets curationThreshold win when both are configured, and says the alias is ignored', () => {
    __resetCurationCadenceWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const subconscious = new Subconscious({ curationCadence: 5, curationThreshold: 20 });
      expect(subconscious.resolved.curationThreshold).toBe(20);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('is ignored');
    } finally {
      warn.mockRestore();
    }
  });

  it('resolves the alias onto the threshold path when curationThreshold is unset', () => {
    __resetCurationCadenceWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const subconscious = new Subconscious({ curationCadence: 7 });
      expect(subconscious.resolved.curationCadence).toBe(7);
      expect(subconscious.resolved.curationThreshold).toBe(7);
      expect(warn.mock.calls[0]?.[0]).not.toContain('is ignored');
    } finally {
      warn.mockRestore();
    }
  });

  it('lets an explicit false threshold disable the deprecated alias', () => {
    __resetCurationCadenceWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const subconscious = new Subconscious({ curationCadence: 7, curationThreshold: false });
      expect(subconscious.resolved.curationThreshold).toBe(false);
      expect(warn.mock.calls[0]?.[0]).toContain('is ignored');
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the existing validation error for an invalid alias value', () => {
    __resetCurationCadenceWarning();
    expect(() => new Subconscious({ curationCadence: 0 })).toThrow(
      'Subconscious curationCadence must be a positive integer.',
    );
    expect(() => new Subconscious({ curationCadence: 1.5 })).toThrow(
      'Subconscious curationCadence must be a positive integer.',
    );
  });

  it('rejects invalid values for the new options', () => {
    expect(() => new Subconscious({ curationThreshold: 0 })).toThrow(
      'Subconscious curationThreshold must be a positive integer or false.',
    );
    expect(() => new Subconscious({ curationMaxAgeMs: -1 })).toThrow(
      'Subconscious curationMaxAgeMs must be a positive integer of milliseconds or false.',
    );
  });

  it('defaults both curation triggers to off', () => {
    const subconscious = new Subconscious();
    expect(subconscious.resolved.curationThreshold).toBe(false);
    expect(subconscious.resolved.curationMaxAgeMs).toBe(false);
  });
});
