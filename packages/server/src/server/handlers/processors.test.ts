import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { TokenLimiterProcessor, ToolCallFilter } from '@mastra/core/processors';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { EXECUTE_PROCESSOR_ROUTE, GET_PROCESSOR_BY_ID_ROUTE, LIST_PROCESSORS_ROUTE } from './processors';

function createMastra() {
  return new Mastra({
    logger: false,
    processors: {
      toolCallFilter: new ToolCallFilter(),
      tokenLimiter: new TokenLimiterProcessor({ limit: 1000 }),
    },
  });
}

describe('processor handlers', () => {
  it('reports the llmRequest phase for processors implementing processLLMRequest', async () => {
    const mastra = createMastra();
    const result = (await LIST_PROCESSORS_ROUTE.handler({ mastra } as any)) as Record<string, { phases: string[] }>;

    expect(result['tool-call-filter']!.phases).toEqual(['llmRequest']);
    expect(result['token-limiter']!.phases).toContain('llmRequest');
    expect(result['token-limiter']!.phases).toContain('inputStep');
  });

  it('rejects direct execution of the llmRequest phase', async () => {
    const mastra = createMastra();
    const promise = EXECUTE_PROCESSOR_ROUTE.handler({
      mastra,
      processorId: 'tool-call-filter',
      phase: 'llmRequest',
      messages: [],
    } as any);

    await expect(promise).rejects.toBeInstanceOf(HTTPException);
    await expect(promise).rejects.toMatchObject({ status: 400 });
  });

  // Hydrated stored agents register their processor configurations on Mastra like code agents do.
  it("doesn't list another user's private stored agent among a processor's agents", async () => {
    const mastra = createMastra();
    const processor = mastra.getProcessorById('tool-call-filter');
    for (const [id, visibility] of [
      ['alice-private', 'private'],
      ['alice-public', 'public'],
    ] as const) {
      const agent = new Agent({
        id,
        name: id,
        instructions: 'x',
        model: 'openai/gpt-4o-mini',
        rawConfig: { id, authorId: 'alice', visibility },
      } as any);
      mastra.addAgent(agent, id, { source: 'stored' });
      mastra.addProcessorConfiguration(processor, id, 'input');
    }
    const caller = (id: string) => {
      const ctx = new RequestContext();
      ctx.set(MASTRA_USER_KEY, { id });
      ctx.set(MASTRA_RESOURCE_ID_KEY, id);
      ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['*:read', '*:execute']);
      return ctx;
    };
    const agentIds = async (requestContext: RequestContext) => {
      const result = (await GET_PROCESSOR_BY_ID_ROUTE.handler({
        mastra,
        processorId: 'tool-call-filter',
        requestContext,
      } as any)) as { configurations: Array<{ agentId: string; agentName: string }> };
      return result.configurations.flatMap(c => [c.agentId, c.agentName]);
    };

    expect(await agentIds(caller('bob'))).toEqual(['alice-public', 'alice-public']);
    expect(await agentIds(caller('alice'))).toEqual(['alice-private', 'alice-private', 'alice-public', 'alice-public']);

    const listed = async (requestContext: RequestContext) => {
      const result = (await LIST_PROCESSORS_ROUTE.handler({ mastra, requestContext } as any)) as Record<
        string,
        { agentIds: string[]; configurations: Array<{ agentId: string }> }
      >;
      const entry = result['tool-call-filter']!;
      return { agentIds: entry.agentIds, configurations: entry.configurations.map(c => c.agentId) };
    };
    expect(await listed(caller('bob'))).toEqual({ agentIds: ['alice-public'], configurations: ['alice-public'] });
    expect(await listed(caller('alice'))).toEqual({
      agentIds: ['alice-private', 'alice-public'],
      configurations: ['alice-private', 'alice-public'],
    });
  });
  // Processor configurations outlive the registry entry: an agent constructed with `mastra` (for example a stored
  // agent loaded at a specific version) adds them without being registered, and code sub-agents are never registered.
  describe('agents that are not registered', () => {
    const caller = (id: string) => {
      const ctx = new RequestContext();
      ctx.set(MASTRA_USER_KEY, { id });
      ctx.set(MASTRA_RESOURCE_ID_KEY, id);
      ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['*:read', '*:execute']);
      return ctx;
    };
    const both = async (mastra: Mastra, requestContext: RequestContext) => {
      const list = (await LIST_PROCESSORS_ROUTE.handler({ mastra, requestContext } as any)) as Record<
        string,
        { agentIds: string[]; configurations: Array<{ agentId: string }> }
      >;
      const byId = (await GET_PROCESSOR_BY_ID_ROUTE.handler({
        mastra,
        processorId: 'tool-call-filter',
        requestContext,
      } as any)) as { configurations: Array<{ agentId: string }> };
      const entry = list['tool-call-filter']!;
      return {
        listAgentIds: [...entry.agentIds].sort(),
        listConfigurations: entry.configurations.map(c => c.agentId).sort(),
        byIdConfigurations: byId.configurations.map(c => c.agentId).sort(),
      };
    };
    const ids = (...agentIds: string[]) => ({
      listAgentIds: agentIds,
      listConfigurations: agentIds,
      byIdConfigurations: agentIds,
    });

    async function setup() {
      const storage = new InMemoryStore();
      const sub = new Agent({
        id: 'code-sub',
        name: 'code-sub',
        instructions: 'x',
        model: 'openai/gpt-4o-mini',
        inputProcessors: [new ToolCallFilter()],
      });
      const mastra = new Mastra({
        logger: false,
        storage,
        processors: { toolCallFilter: new ToolCallFilter() },
        agents: {
          code: new Agent({
            id: 'code',
            name: 'code',
            instructions: 'x',
            model: 'openai/gpt-4o-mini',
            inputProcessors: [new ToolCallFilter()],
            agents: { sub },
          }),
        },
      });
      await mastra.getAgentById('code').listAgents({ requestContext: new RequestContext() });
      const agentsStore = (await storage.getStore('agents'))!;
      const stored = (id: string) => {
        const rawConfig = { id, authorId: 'alice', visibility: 'private' };
        return new Agent({
          id,
          name: id,
          instructions: 'x',
          model: 'openai/gpt-4o-mini',
          inputProcessors: [new ToolCallFilter()],
          rawConfig,
          mastra,
        } as any);
      };
      for (const id of ['alice-evicted']) {
        await agentsStore.create({
          agent: {
            id,
            name: id,
            instructions: 'x',
            model: { provider: 'openai', name: 'gpt-4o-mini' },
            authorId: 'alice',
            visibility: 'private',
          } as any,
        });
      }
      return { mastra, agentsStore, stored };
    }

    it("hides a private stored agent once it's evicted from the registry, on both routes", async () => {
      const { mastra, stored } = await setup();
      mastra.addAgent(stored('alice-evicted'), 'alice-evicted', { source: 'stored' });
      expect(await both(mastra, caller('bob'))).toEqual(ids('code', 'code-sub'));

      // Every stored-agent update, delete and version activation evicts it like this.
      mastra.removeAgent('alice-evicted');

      expect(await both(mastra, caller('bob'))).toEqual(ids('code', 'code-sub'));
      expect(await both(mastra, caller('alice'))).toEqual(ids('code', 'code-sub'));
    });

    it("hides a deleted private stored agent, and keeps code sub-agents' configurations", async () => {
      const { mastra, agentsStore, stored } = await setup();
      mastra.addAgent(stored('alice-evicted'), 'alice-evicted', { source: 'stored' });

      // DELETE /stored/agents/:id deletes the record, then evicts the agent.
      await agentsStore.delete('alice-evicted');
      mastra.removeAgent('alice-evicted');

      expect(await both(mastra, caller('bob'))).toEqual(ids('code', 'code-sub'));
    });

    it('decides an agent that is not registered from its stored record', async () => {
      const { mastra, stored } = await setup();
      // A stored agent used as another agent's sub-agent registers its configurations without being in the registry.
      const agent = stored('alice-evicted');
      agent.__registerMastra(mastra);

      expect(await both(mastra, caller('bob'))).toEqual(ids('code', 'code-sub'));
      expect(await both(mastra, caller('alice'))).toEqual(ids('alice-evicted', 'code', 'code-sub'));
    });
  });
});
