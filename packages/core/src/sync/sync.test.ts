import { describe, it, expect, jest } from '@jest/globals';
import { Mastra } from '../mastra';
import { createSync } from '.';
import { MockEngine } from '../engine/engine.mock';
import { z } from 'zod';
import { PropertyType } from '../engine';

const mockEngine = new MockEngine({
  url: 'http://localhost:3000',
});

const testSync = createSync({
  label: 'test',
  description: 'test',
  schema: z.object({
    name: z.string(),
  }),
  outputShema: z.object({
    message: z.string(),
  }),
  executor: async ({ data }) => {
    return {
      message: `Hello, ${data.name}`,
    };
  },
});

const testSync2 = createSync({
  label: 'test2',
  description: 'test2',
  schema: z.object({
    venue: z.string(),
  }),
  outputShema: z.object({
    message: z.string(),
  }),
  executor: async ({ data }) => {
    return {
      message: `Welcome to ${data.venue}`,
    };
  },
});

const executorSpy = jest.fn<any>().mockResolvedValue({
  message: 'Test response',
});

const testSyncWithSpy = createSync({
  label: 'spyTest',
  description: 'test parameters',
  schema: z.object({
    name: z.string(),
  }),
  outputShema: z.object({
    message: z.string(),
  }),
  executor: executorSpy,
});

const syncDataSpy = jest.spyOn(mockEngine, 'syncData');

const syncWithData = createSync({
  label: 'syncDataTest',
  description: 'test sync data',
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  outputShema: z.object({
    success: z.boolean(),
  }),
  executor: async ({ data, engine }) => {
    const testProperties = [
      {
        id: '1',
        name: 'name',
        type: PropertyType.SINGLE_LINE_TEXT,
        config: { required: true },
        description: 'Name field',
        displayName: 'Name',
        modifiable: true,
        order: 1,
        visible: true,
      },
      {
        id: '2',
        name: 'age',
        type: PropertyType.NUMBER,
        config: { required: true },
        description: 'Age field',
        displayName: 'Age',
        modifiable: true,
        order: 2,
        visible: true,
      },
    ];

    await engine.syncData({
      connectionId: 'test-connection',
      name: 'user',
      data: { name: data.name, age: data.age },
      type: 'user',
      properties: testProperties,
    });

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
      data: { name: 'John' },
      agents: new Map(),
      engine: expect.any(MockEngine),
      integrationsRegistry: expect.any(Function),
      llm: expect.objectContaining({
        logger: expect.objectContaining({
          level: 'INFO',
        }),
      }),
      toolsRegistry: expect.any(Function),
      vectors: undefined,
    });

    expect(executorParams.engine).toBeInstanceOf(MockEngine);
    expect(executorParams.data).toEqual({ name: 'John' });
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
      data: { name: 'John', age: 30 },
      type: 'user',
      properties: expect.arrayContaining([
        expect.objectContaining({
          name: 'name',
          type: PropertyType.SINGLE_LINE_TEXT,
        }),
        expect.objectContaining({
          name: 'age',
          type: PropertyType.NUMBER,
        }),
      ]),
    });

    syncDataSpy.mockRestore();
  });
});
