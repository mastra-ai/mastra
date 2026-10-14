import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Knowledge } from '../../index';

const binding = { source: 'slack:general', scope: 'project:one' } as const;

/** An agent that acknowledges the checkpoint without calling any write tool. */
function idleAgent() {
  const agent = new Agent({
    id: 'distiller',
    name: 'distiller',
    instructions: 'Import.',
    memory: new MockMemory(),
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: 'Nothing to import. <import-complete checkpoint="c1" />' }],
      }),
    }),
  });
  new Mastra({ agents: { distiller: agent }, logger: false });
  // The importer requires resource-scoped observational memory, which lives in @mastra/memory.
  const getMemory = agent.getMemory.bind(agent);
  vi.spyOn(agent, 'getMemory').mockImplementationOnce(async () => {
    const memory = await getMemory();
    return Object.assign(Object.create(memory!), {
      getMergedThreadConfig: () => ({ observationalMemory: { scope: 'resource' } }),
    });
  });
  return agent;
}

describe('agentic import runs that write nothing', () => {
  it('succeed and log the zero-write warning', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'zero-write-run' }),
      structure: {
        scopes: [
          { address: 'org:acme', name: 'Acme' },
          { address: binding.scope, name: 'One', parentAddresses: ['org:acme'] },
        ],
      },
      importers: [
        {
          id: 'slack',
          access: { [binding.scope]: 'edit' },
          agentic: { agent: idleAgent() },
          handler: async ctx => {
            await ctx.agentImport!({ instructions: 'Import.', data: { m: 1 }, checkpoint: 'c1' });
          },
        },
      ],
    });
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    knowledge.__setLogger(logger as never);
    await knowledge.reconcile();

    const run = await knowledge.getImporter('slack')!.run(binding);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe('succeeded');
    expect(logger.warn).toHaveBeenCalledWith(
      'Knowledge agentic import acknowledged its checkpoint without writing',
      expect.objectContaining({ importerId: 'slack', runId: run.id, checkpoint: 'c1' }),
    );
  });
});
