import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it, vi } from 'vitest';

import type { DurableAgentExecutionEngine } from '../execution-engine';
import { createDurableAgent } from '../create-durable-agent';
import { createDurableAgenticWorkflow } from '../workflows';
import { Agent } from '../../agent';

describe('DurableAgentExecutionEngine', () => {
  it('delegates workflow creation and start while retaining the core stream contract', async () => {
    const workflow = createDurableAgenticWorkflow();
    const engine: DurableAgentExecutionEngine = {
      createWorkflow: vi.fn(() => workflow),
      start: vi.fn(async () => ({ status: 'running' })),
      resume: vi.fn(async () => ({ status: 'running' })),
      recover: vi.fn(async () => ({ status: 'running' })),
      abort: vi.fn(async () => undefined),
      status: vi.fn(async () => 'running'),
    };
    const agent = new Agent({
      id: 'external-engine-agent',
      name: 'External engine agent',
      instructions: 'Test external durable execution.',
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
      } as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent, executionEngine: engine });

    expect(durableAgent.getWorkflow()).toBe(workflow);
    expect(engine.createWorkflow).toHaveBeenCalledWith({ maxSteps: undefined });

    const result = await durableAgent.stream('Run durably');
    await vi.waitFor(() => expect(engine.start).toHaveBeenCalledOnce());
    expect(engine.start).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow,
        runId: result.runId,
        input: expect.objectContaining({ agentId: agent.id }),
      }),
    );
    result.cleanup();
  });
});
