import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgentExecutionEngine } from '../execution-engine';
import { createDurableAgenticWorkflow } from '../workflows';

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

  it('forwards an external abort signal to the engine for an initial segment', async () => {
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
      id: 'external-engine-abort-agent',
      name: 'External engine abort agent',
      instructions: 'Test external durable execution aborts.',
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
      } as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent, executionEngine: engine });
    const controller = new AbortController();

    const result = await durableAgent.stream('Run durably', { abortSignal: controller.signal });
    await vi.waitFor(() => expect(engine.start).toHaveBeenCalledOnce());
    const reason = new Error('cancel initial segment');
    controller.abort(reason);

    await vi.waitFor(() => expect(engine.abort).toHaveBeenCalledOnce());
    expect(engine.abort).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow,
        runId: result.runId,
        reason,
      }),
    );
    result.cleanup();
  });

  it('forwards an external abort signal to the engine for a resumed segment', async () => {
    const workflow = createDurableAgenticWorkflow();
    const engine: DurableAgentExecutionEngine = {
      createWorkflow: vi.fn(() => workflow),
      start: vi.fn(async () => ({ status: 'suspended' })),
      resume: vi.fn(async () => ({ status: 'running' })),
      recover: vi.fn(async () => ({ status: 'running' })),
      abort: vi.fn(async () => undefined),
      status: vi.fn(async () => 'running'),
    };
    const agent = new Agent({
      id: 'external-engine-resume-abort-agent',
      name: 'External engine resume abort agent',
      instructions: 'Test external durable execution resume aborts.',
      model: {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-model',
      } as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent, executionEngine: engine });
    const initial = await durableAgent.stream('Run durably');
    await vi.waitFor(() => expect(engine.start).toHaveBeenCalledOnce());
    const controller = new AbortController();

    const resumed = await durableAgent.resume(initial.runId, { approved: true }, { abortSignal: controller.signal });
    await vi.waitFor(() => expect(engine.resume).toHaveBeenCalledOnce());
    const reason = new Error('cancel resumed segment');
    controller.abort(reason);

    await vi.waitFor(() => expect(engine.abort).toHaveBeenCalledOnce());
    expect(engine.abort).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow,
        runId: initial.runId,
        reason,
      }),
    );
    resumed.cleanup();
    initial.cleanup();
  });
});
