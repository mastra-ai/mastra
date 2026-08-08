import { Agent } from '@mastra/core/agent';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';

import { createInngestAgent, isInngestAgent } from './create-inngest-agent';

describe('isInngestAgent', () => {
  it('requires the durable agent, Inngest client, and workflow accessor', () => {
    const inngest = new Inngest({ id: 'type-guard-test' });
    const agent = new Agent({
      id: 'type-guard-test',
      name: 'Type Guard Test',
      instructions: 'Test',
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
      } as any,
    });
    const durableAgent = createInngestAgent({ agent, inngest });

    expect(isInngestAgent(durableAgent)).toBe(true);
    expect(isInngestAgent(agent)).toBe(false);
    expect(isInngestAgent(null)).toBe(false);
    expect(isInngestAgent({})).toBe(false);
    expect(
      isInngestAgent({
        inngest,
        getDurableWorkflows: () => [],
      }),
    ).toBe(false);
  });
});
