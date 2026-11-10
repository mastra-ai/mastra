import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { TokenLimiterProcessor, ToolCallFilter } from '@mastra/core/processors';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
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
  it("doesn't list another user's private stored agent among a processor's configurations", async () => {
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
  });
});
