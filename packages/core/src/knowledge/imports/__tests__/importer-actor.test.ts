import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import type { IFGAProvider } from '../../../auth/ee/interfaces/fga';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Knowledge } from '../../index';

const binding = { source: 'slack:general', scope: 'project:one' } as const;
const structure = {
  scopes: [
    { address: 'org:acme', name: 'Acme' },
    { address: binding.scope, name: 'One', parentAddresses: ['org:acme'] },
  ],
};

function fgaProvider(): IFGAProvider {
  return { check: vi.fn().mockResolvedValue(true), require: vi.fn(), filterAccessible: vi.fn() };
}

/** A real Agent registered in a Mastra whose server has an FGA provider. */
function realAgent(fga: IFGAProvider) {
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
        content: [{ type: 'text', text: 'Done. <import-complete checkpoint="c1" />' }],
      }),
    }),
  });
  new Mastra({ agents: { distiller: agent }, logger: false, server: { fga } });
  // The importer requires resource-scoped observational memory, which lives in @mastra/memory.
  // Only the importer's own config probe sees this; the agent run uses its real MockMemory.
  const getMemory = agent.getMemory.bind(agent);
  vi.spyOn(agent, 'getMemory').mockImplementationOnce(async () => {
    const memory = await getMemory();
    return Object.assign(Object.create(memory!), {
      getMergedThreadConfig: () => ({ observationalMemory: { scope: 'resource' } }),
    });
  });
  return agent;
}

function knowledgeWith(agent: Agent, organizationId?: string) {
  return new Knowledge({
    storage: new InMemoryStore({ id: 'importer-actor' }),
    structure,
    importers: [
      {
        id: 'slack',
        ...(organizationId ? { organizationId } : {}),
        access: { [binding.scope]: 'edit' },
        agentic: { agent },
        handler: async ctx => {
          await ctx.agentImport!({ instructions: 'Import.', data: { m: 1 }, checkpoint: 'c1' });
        },
      },
    ],
  });
}

describe('agentic importer runs carry the importer as an FGA subject', () => {
  it('fails closed under FGA when the registration has no org', async () => {
    const fga = fgaProvider();
    const knowledge = knowledgeWith(realAgent(fga));
    await knowledge.reconcile();

    const run = await knowledge.getImporter('slack')!.run(binding);

    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/trusted actor requires organizationId/);
    // Denied at the trusted-actor gate, not at the user check: no user is ever consulted.
    expect(fga.require).not.toHaveBeenCalled();
    expect(fga.check).not.toHaveBeenCalled();
  });

  it("passes the registration's org into the actor and the run's tenant scope", async () => {
    const fga = fgaProvider();
    const agent = realAgent(fga);
    const generate = vi.spyOn(agent, 'generate');
    const knowledge = knowledgeWith(agent, 'acme');
    await knowledge.reconcile();

    const run = await knowledge.getImporter('slack')!.run(binding);

    expect(run.error).toBeUndefined();
    expect(run.status).toBe('succeeded');
    const options = (generate.mock.calls[0] as unknown[])[1] as any;
    expect(options.actor).toEqual({
      actorKind: 'system',
      agentId: 'importer:slack',
      scope: { org: 'acme' },
      permissions: ['knowledge-importers:execute'],
    });
    expect(options.requestContext.get('organizationId')).toBe('acme');
    expect(fga.require).not.toHaveBeenCalled();
  });

  it('rejects an org id that is empty or nests a scope separator at registration', () => {
    const agent = realAgent(fgaProvider());
    expect(() => knowledgeWith(agent, ' ')).toThrow(/organizationId/);
    expect(() => knowledgeWith(agent, 'acme:other')).toThrow(/organizationId/);
  });
});
