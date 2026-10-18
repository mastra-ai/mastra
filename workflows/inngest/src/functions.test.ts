import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';

import { createInngestAgent } from './durable-agent';
import { collectInngestFunctions } from './functions';

function createAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'Test',
    model: {
      provider: 'test',
      modelId: 'test-model',
      specificationVersion: 'v1',
      supportsStructuredOutputs: true,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    } as any,
  });
}

describe('collectInngestFunctions()', () => {
  it('collects the original durable workflow owned by an Inngest agent', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const durableAgent = createInngestAgent({ agent: createAgent('test-agent'), inngest });
    const workflow = durableAgent.getDurableWorkflows()[0];
    const originalFunctions = workflow.getFunctions();
    const mastra = new Mastra({
      storage: new MockStore(),
      agents: { testAgent: durableAgent },
    });

    const functions = collectInngestFunctions({ mastra });

    expect(functions).toEqual(originalFunctions);
    expect(workflow.__getPubsubFactory()).toBeTypeOf('function');
  });

  it('collects the shared durable workflow from only the first Inngest agent', () => {
    const inngest = new Inngest({ id: 'test-app' });
    const firstAgent = createInngestAgent({ agent: createAgent('first-agent'), inngest });
    const secondAgent = createInngestAgent({ agent: createAgent('second-agent'), inngest });
    const firstFunctions = firstAgent.getDurableWorkflows()[0].getFunctions();
    const mastra = new Mastra({
      storage: new MockStore(),
      agents: { firstAgent, secondAgent },
    });
    const firstWorkflows = vi.spyOn(firstAgent, 'getDurableWorkflows');
    const secondWorkflows = vi.spyOn(secondAgent, 'getDurableWorkflows');

    const functions = collectInngestFunctions({ mastra });

    expect(functions).toEqual(firstFunctions);
    expect(firstWorkflows).toHaveBeenCalledOnce();
    expect(secondWorkflows).not.toHaveBeenCalled();
  });
});
