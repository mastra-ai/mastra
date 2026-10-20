import { Mastra } from '@mastra/core/mastra';
import { TokenLimiterProcessor, ToolCallFilter } from '@mastra/core/processors';
import { describe, expect, it } from 'vitest';
import { HTTPException } from '../http-exception';
import { EXECUTE_PROCESSOR_ROUTE, LIST_PROCESSORS_ROUTE } from './processors';

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
});
