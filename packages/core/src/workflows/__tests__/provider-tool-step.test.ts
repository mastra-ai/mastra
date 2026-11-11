import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import type { ToolProvider } from '../../tool-provider';
import type { ToolAction } from '../../tools';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { createWorkflow as createEventedWorkflow } from '../evented';
import { createStep } from '../workflow';

const ENGINES = [
  { name: 'default', workflowFactory: createWorkflow },
  { name: 'evented', workflowFactory: createEventedWorkflow },
] as const;

describe.each(ENGINES)('provider tool steps ($name engine)', ({ name, workflowFactory }) => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves one provider tool per run and passes its output to the next step', async () => {
    const execute = vi.fn(async ({ value }: { value: number }) => ({ doubled: value * 2 }));
    const tool = createTool({
      id: 'mock.double',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      execute,
    });
    const finish = createStep({
      id: 'finish',
      inputSchema: z.object({ doubled: z.number() }),
      outputSchema: z.object({ tripled: z.number() }),
      execute: async ({ inputData }) => ({ tripled: inputData.doubled * 1.5 }),
    });
    const resolveToolsVNext = vi.fn(async () => ({ 'mock.double': tool }));
    const provider = {
      id: 'mock',
      resolveToolsVNext,
    } as unknown as ToolProvider;
    const editor = {
      registerWithMastra: vi.fn(),
      getToolProviderOrThrow: (id: string) => {
        if (id !== 'mock') throw new Error(`Unknown provider: ${id}`);
        return provider;
      },
      getToolProvider: (id: string) => (id === 'mock' ? provider : undefined),
      getToolProviders: () => ({ mock: provider }),
    };

    const workflow = workflowFactory({
      id: `provider-tool-${name}`,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ tripled: z.number() }),
    })
      .tool({
        type: 'provider',
        providerId: 'mock',
        toolSlug: 'mock.double',
        connection: {
          kind: 'invoker',
          connectionId: 'connection-1',
          toolkit: 'mock',
        },
      })
      .then(finish)
      .commit();
    expect(workflow.engineType).toBe(name);

    const mastra = new Mastra({
      editor: editor as any,
      workflows: { [workflow.id]: workflow },
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);

    try {
      if (name === 'evented') await mastra.startWorkers();
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { value: 3 } });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({ tripled: 9 });
      }
      expect(resolveToolsVNext).toHaveBeenCalledWith(
        expect.objectContaining({
          toolSlugs: ['mock.double'],
          connectionId: 'connection-1',
          kind: 'invoker',
          toolkit: 'mock',
        }),
      );
      expect(execute).toHaveBeenCalledOnce();
    } finally {
      if (name === 'evented') await mastra.stopWorkers?.();
    }
  });
});

describe.each(ENGINES)('provider-returned plain tool validation ($name engine)', ({ name, workflowFactory }) => {
  async function runPlainTool(tool: ToolAction<any, any>, inputData: unknown) {
    const provider = {
      id: 'mock',
      resolveToolsVNext: vi.fn(async () => ({ 'mock.double': tool })),
    } as unknown as ToolProvider;
    const editor = {
      registerWithMastra: vi.fn(),
      getToolProviderOrThrow: () => provider,
      getToolProvider: () => provider,
      getToolProviders: () => ({ mock: provider }),
    };
    const workflow = workflowFactory({
      id: `provider-tool-validation-${name}`,
      inputSchema: z.unknown(),
      outputSchema: z.unknown(),
    })
      .tool({
        type: 'provider',
        providerId: 'mock',
        toolSlug: 'mock.double',
        connection: { kind: 'invoker', connectionId: 'connection-1', toolkit: 'mock' },
      })
      .commit();
    const mastra = new Mastra({
      editor: editor as any,
      workflows: { [workflow.id]: workflow },
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);

    try {
      if (name === 'evented') await mastra.startWorkers();
      return await (await workflow.createRun()).start({ inputData });
    } finally {
      if (name === 'evented') await mastra.stopWorkers?.();
    }
  }

  it('validates input before executing the tool action', async () => {
    const execute = vi.fn(async ({ value }: { value: number }) => ({ doubled: value * 2 }));
    const result = await runPlainTool(
      {
        id: 'mock.double',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
        execute,
      },
      { value: 'not-a-number' },
    );

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error?.message).toContain('Tool input validation failed for mock.double');
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('validates output after executing the tool action', async () => {
    const execute = vi.fn(async () => ({ doubled: 'not-a-number' }));
    const result = await runPlainTool(
      {
        id: 'mock.double',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
        execute,
      },
      { value: 2 },
    );

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error?.message).toContain('Tool output validation failed for mock.double');
    }
    expect(execute).toHaveBeenCalledOnce();
  });
});

describe('provider tool step construction', () => {
  it('rejects scorers before mutating the workflow graph', () => {
    const workflow = createWorkflow({
      id: 'provider-tool-options',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });

    expect(() =>
      workflow.tool({ type: 'provider', providerId: 'mock', toolSlug: 'mock.double' }, {
        scorers: { quality: {} },
      } as any),
    ).toThrow('option "scorers" is not supported');
    expect(workflow.stepGraph).toEqual([]);
  });

  it('rejects author connections before mutating a code-defined workflow graph', () => {
    const workflow = createWorkflow({
      id: 'provider-tool-author-connection',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    });

    expect(() =>
      workflow.tool({
        type: 'provider',
        providerId: 'mock',
        toolSlug: 'mock.double',
        connection: { kind: 'author', connectionId: 'connection-1', toolkit: 'mock', scope: 'per-author' },
      }),
    ).toThrow('cannot use an author connection in a code-defined workflow');
    expect(workflow.stepGraph).toEqual([]);
  });

  it('derives distinct default ids for the same tool slug from different providers', () => {
    const workflow = createWorkflow({
      id: 'provider-tool-default-ids',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    })
      .tool({ type: 'provider', providerId: 'provider-a', toolSlug: 'shared.tool' })
      .tool({ type: 'provider', providerId: 'provider-b', toolSlug: 'shared.tool' });

    expect(workflow.stepGraph.map(step => step.id)).toEqual(['provider-a:shared.tool', 'provider-b:shared.tool']);
    expect(Object.keys(workflow.steps)).toEqual(['provider-a:shared.tool', 'provider-b:shared.tool']);
  });

  it('surfaces a missing provider as a failed workflow step', async () => {
    const workflow = createWorkflow({
      id: 'missing-provider',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
    })
      .tool({
        type: 'provider',
        providerId: 'missing',
        toolSlug: 'missing.double',
        connection: { kind: 'invoker', connectionId: 'connection-1', toolkit: 'missing' },
      })
      .commit();
    const editor = {
      registerWithMastra: vi.fn(),
      getToolProviderOrThrow: (id: string) => {
        throw new Error(`Unknown provider: ${id}`);
      },
      getToolProvider: () => undefined,
      getToolProviders: () => ({}),
    };
    const mastra = new Mastra({
      editor: editor as any,
      workflows: { [workflow.id]: workflow },
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);

    const result = await (await workflow.createRun()).start({ inputData: { value: 3 } });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error?.message).toContain('Unknown provider: missing');
    }
  });
});
