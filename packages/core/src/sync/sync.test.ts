import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

import { MockMastraEngine } from '../engine';
import { Mastra } from '../mastra';

import { createSync } from '.';

const mockEngine = new MockMastraEngine({
  url: 'http://localhost:3000',
});

const testSync = createSync({
  id: 'test',
  description: 'test',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      message: `Hello, ${context.name}`,
    };
  },
});

const testSync2 = createSync({
  id: 'test2',
  description: 'test2',
  inputSchema: z.object({
    venue: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      message: `Welcome to ${context.venue}`,
    };
  },
});

const executorSpy = vi.fn<any>().mockResolvedValue({
  message: 'Test response',
});

const testSyncWithSpy = createSync({
  id: 'spyTest',
  description: 'test parameters',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: executorSpy,
});

const syncDataSpy = vi.spyOn(mockEngine, 'syncRecords');

const syncWithData = createSync({
  id: 'syncDataTest',
  description: 'test sync data',
  inputSchema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context, mastra }) => {
    if (mastra?.engine) {
      await mastra.engine.syncRecords({
        connectionId: 'test-connection',
        name: 'user',
        records: [{ data: { name: context.name, age: context.age }, externalId: '1' }],
      });
    }
    return { success: true };
  },
});

const mastra = new Mastra({
  engine: mockEngine,
  syncs: { testSync, testSync2, testSyncWithSpy, syncWithData },
});

describe('Mastra Sync', () => {
  it('should register sync functions', () => {
    expect(mastra['syncs']).toHaveProperty('testSync');
    expect(mastra['syncs']).toHaveProperty('testSync2');
  });

  it('should hydrate sync executor params', async () => {
    await mastra.sync('testSyncWithSpy', { name: 'John' });

    expect(executorSpy).toHaveBeenCalledTimes(1);

    const executorParams = executorSpy.mock.calls?.[0]?.[0] as any;

    expect(executorParams).toMatchObject({
      context: { name: 'John' },
      mastra: {
        agents: new Map(),
        engine: expect.any(MockMastraEngine),
        llm: expect.any(Function),
        vectors: undefined,
      },
    });

    expect(executorParams.mastra.engine).toBeInstanceOf(MockMastraEngine);
    expect(executorParams.context).toEqual({ name: 'John' });
  });

  it('Should execute sync function', async () => {
    const result = await mastra.sync('testSync', { name: 'John' });
    const result2 = await mastra.sync('testSync2', { venue: 'Lagos' });
    expect(result).toEqual({ message: 'Hello, John' });
    expect(result2).toEqual({ message: 'Welcome to Lagos' });
  });

  it('should sync data', async () => {
    await mastra.sync('syncWithData', { name: 'John', age: 30 });

    expect(syncDataSpy).toHaveBeenCalledTimes(1);
    expect(syncDataSpy).toHaveBeenCalledWith({
      connectionId: 'test-connection',
      name: 'user',
      records: [
        {
          data: {
            name: 'John',
            age: 30,
          },
          externalId: '1',
        },
      ],
    });

    syncDataSpy.mockRestore();
  });
});
