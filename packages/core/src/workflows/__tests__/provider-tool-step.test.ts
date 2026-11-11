import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import type { ToolProvider } from '../../tool-provider';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';

const ENGINES = [
  { name: 'default', evented: false },
  { name: 'evented', evented: true },
] as const;

describe.each(ENGINES)('provider tool steps ($name engine)', ({ evented }) => {
  beforeEach(() => {
    if (evented) {
      process.env.MASTRA_EVENTED_EXECUTION = 'true';
    } else {
      delete process.env.MASTRA_EVENTED_EXECUTION;
    }
  });

  afterEach(() => {
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  it('resolves and executes one provider tool per run', async () => {
    const execute = vi.fn(async ({ value }: { value: number }) => ({ doubled: value * 2 }));
    const tool = createTool({
      id: 'mock.double',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      execute,
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

    const workflow = createWorkflow({
      id: `provider-tool-${evented ? 'evented' : 'default'}`,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
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
      .commit();

    const mastra = new Mastra({
      editor: editor as any,
      workflows: { [workflow.id]: workflow },
      storage: new InMemoryStore(),
      logger: false,
    });
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 3 } });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ doubled: 6 });
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
  });
});
